// Setor de e-mails da ALVO: envia pelo Resend (remetente suporte@alvoinvestimentos.com) e registra em mail_log.
// A chave do Resend fica só aqui (segredo RESEND_API_KEY). Quem pode usar: perfis com Suporte nível 3 (dono, admin, suporte).
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import { catalog, noticeCategories, journeyEmail, noticeEmail, type Kind, type Campaign, type Assembly } from './templates.ts';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
let KEY = (Deno.env.get('RESEND_API_KEY') || '').trim();
const RESEND = () => KEY;
const FROM = 'ALVO Investimentos <suporte@alvoinvestimentos.com>';
const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'GET, POST, OPTIONS'};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), {status: s, headers: {...cors, 'Content-Type': 'application/json'}});
const html = (t: string) => new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:Arial;background:#f1eee5;color:#123b2e;display:grid;place-items:center;min-height:90vh"><div style="max-width:480px;background:#fffcf6;border:1px solid #e7e0d2;border-radius:16px;padding:28px;text-align:center"><b style="letter-spacing:4px">ALVO</b><p>'+t+'</p></div>', {headers: {'Content-Type': 'text/html; charset=utf-8'}});
const okEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e || '');
const admin = createClient(URL_, SERVICE, {auth: {persistSession: false}});
// campanha: só links seguros no botão
function campaignOf(c: any): Campaign {
  const u = String(c?.ctaUrl || '').trim();
  if (u && !/^(https:\/\/|mailto:)/i.test(u)) throw new Error('O link do botão deve começar com https:// (ex.: https://wa.me/55...).');
  const hl = Array.isArray(c?.highlights) ? c.highlights.map((x: unknown) => String(x).slice(0, 160)).slice(0, 3) : [];
  return {eyebrow: String(c?.eyebrow || '').slice(0, 40), headline: String(c?.headline || '').slice(0, 120), subtitle: String(c?.subtitle || '').slice(0, 220), highlights: hl, ctaLabel: String(c?.ctaLabel || '').slice(0, 40), ctaUrl: u.slice(0, 500)};
}
// chave do Resend: segredo da função ou cofre do banco (vault, lido só com a chave de serviço)
async function loadKey() { if (!KEY) { const {data} = await admin.rpc('mail_resend_key'); KEY = String(data || '').trim(); } return KEY; }

async function resend(path: string, init: RequestInit = {}) {
  const r = await fetch('https://api.resend.com' + path, {...init, signal: AbortSignal.timeout(15000), headers: {Authorization: 'Bearer ' + RESEND(), 'Content-Type': 'application/json', ...(init.headers || {})}});
  const p = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('Resend ' + r.status + ': ' + (p?.message || p?.error || 'erro'));
  return p;
}
const mapStatus = (ev: string) => ev === 'bounced' ? 'devolvido' : ev === 'complained' ? 'spam' : (ev === 'failed' || ev === 'suppressed') ? 'falhou' : ev === 'opened' || ev === 'clicked' ? 'aberto' : ev === 'delivered' ? 'entregue' : 'enviado';

const todayCuiaba = () => new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Cuiaba'}).format(new Date());
type Active = {email: string; name: string; client_id: string | null; opt_out: boolean; birth_date: string | null; cotas: {case_id: string; adm: string; grp: string; quota: string}[]};
const uniq = (a: (string | null | undefined)[]) => [...new Set(a.filter(Boolean) as string[])];
// envia uma lista de e-mails (lotes de 100), registrando antes no mail_log
async function deliver(org: string, items: {to: string; name: string; ref: string; subject: string; html: string; text: string; template: string; eventDate?: string | null; body?: string}[], by: string, kind = 'cliente') {
  let sent = 0;
  for (let i = 0; i < items.length; i += 100) {
    const part = items.slice(i, i + 100);
    const ins = await admin.from('mail_log').insert(part.map(o => ({organization_id: org, kind, template: o.template, ref_id: o.ref, to_name: o.name, to_email: o.to, subject: o.subject, body: o.body || null, event_date: o.eventDate || null, status: 'enviando', sent_by: by}))).select('id');
    if (ins.error) throw ins.error;
    const ids = ins.data.map((r: any) => r.id);
    try {
      const res = await resend('/emails/batch', {method: 'POST', headers: {'Idempotency-Key': 'alvo-' + ids[0]}, body: JSON.stringify(part.map(o => ({from: FROM, to: [o.to], subject: o.subject, html: o.html, text: o.text})))});
      const data = Array.isArray(res?.data) ? res.data : [];
      for (let k = 0; k < ids.length; k++) {
        const id = data[k]?.id;
        await admin.from('mail_log').update(id ? {status: 'enviado', provider_id: id, updated_at: new Date().toISOString()} : {status: 'incerto', error: 'Resend não confirmou', updated_at: new Date().toISOString()}).eq('id', ids[k]);
        if (id) sent++;
      }
    } catch (e) {
      const msg = (e as Error).message;
      await admin.from('mail_log').update({status: /^Resend 4\d\d/.test(msg) ? 'falhou' : 'incerto', error: msg, updated_at: new Date().toISOString()}).in('id', ids);
    }
  }
  return sent;
}
const recipientOf = (c: Active, eventDate?: string) => ({name: c.name, email: c.email, administrator: uniq(c.cotas.map(x => x.adm)).join(' · ') || '—', group: uniq(c.cotas.map(x => x.grp)).join(' · ') || '—', quota: uniq(c.cotas.map(x => x.quota)).join(' · ') || '—', eventDate});
async function runCron() {
  const today = todayCuiaba(), day = Number(today.slice(8, 10)), md = today.slice(5), out: Record<string, unknown> = {today};
  const {data: orgs} = await admin.from('organizations').select('id');
  for (const o of orgs || []) {
    const org = o.id as string;
    const {data: act} = await admin.rpc('mail_active_clients', {p_org: org});
    const clients = (act || []) as Active[];
    const already = async (template: string, eventDate: string | null, since?: string) => {
      let q = admin.from('mail_log').select('to_email').eq('organization_id', org).eq('template', template).in('status', ['enviando', 'enviado', 'entregue', 'aberto', 'incerto']);
      q = eventDate ? q.eq('event_date', eventDate) : q.gte('created_at', since!);
      const {data} = await q; return new Set((data || []).map((r: any) => String(r.to_email).toLowerCase()));
    };
    const batch: any[] = [];
    // lembretes de pagamento (vencimento dia 10)
    const kind: Kind | null = day === 2 || day === 7 ? 'payment-reminder' : day === 10 ? 'payment-last-day' : null;
    if (kind && RESEND()) {
      const due = today.slice(0, 8) + '10', done = await already(kind, due);
      for (const c of clients) if (!done.has(c.email)) { const m = journeyEmail(kind, recipientOf(c, due)); batch.push({to: c.email, name: c.name, ref: c.client_id || c.email, subject: m.subject, html: m.html, text: m.text, template: kind, eventDate: due}); }
    }
    // aniversários
    if (RESEND()) {
      const done = await already('birthday', null, today + 'T00:00:00-04:00');
      for (const c of clients) if (c.birth_date && String(c.birth_date).slice(5, 10) === md && !c.opt_out && !done.has(c.email)) {
        const m = journeyEmail('birthday', recipientOf(c)); batch.push({to: c.email, name: c.name, ref: c.client_id || c.email, subject: m.subject, html: m.html, text: m.text, template: 'birthday'});
      }
    }
    const sent = batch.length ? await deliver(org, batch, 'Automático') : 0;
    // parcelas em atraso → notificação para o(s) proprietário(s)
    const {data: od} = await admin.rpc('fin_overdue', {p_org: org});
    const {data: owners} = await admin.from('memberships').select('user_id').eq('organization_id', org).eq('role_key', 'PROPRIETARIO').eq('status', 'ATIVO');
    let notified = 0;
    for (const x of (od || []) as any[]) for (const w of owners || []) {
      const key = 'atraso:' + w.user_id + ':' + x.case_id + ':' + x.n;
      const {error} = await admin.from('notifications').insert({organization_id: org, user_id: w.user_id, kind: 'parcela_atraso', target_view: 'financeiro', dedupe_key: key,
        body: 'Parcela ' + x.n + ' de ' + x.client + ' venceu em ' + String(x.due).split('-').reverse().join('/') + ' e não foi confirmada.'});
      if (!error) notified++;
    }
    out[org] = {ativos: clients.length, emails: sent, lembrete: kind, atrasos: (od || []).length, novas_notificacoes: notified};
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', {headers: cors});
  const url = new URL(req.url);

  // descadastro de campanhas (link no rodapé dos e-mails promocionais)
  if (req.method === 'GET' && url.searchParams.get('unsub')) {
    const t = url.searchParams.get('unsub')!;
    if (!/^[a-f0-9]{32,64}$/.test(t)) return html('Link inválido.');
    const {data} = await admin.from('clients').select('id,metadata').eq('metadata->>mail_token', t).maybeSingle();
    if (!data) return html('Link inválido ou já utilizado.');
    await admin.from('clients').update({metadata: {...data.metadata, opt_out: true, marketing_ok: false, opt_out_at: new Date().toISOString()}}).eq('id', data.id);
    return html('Pronto. Você não receberá mais comunicações promocionais da ALVO.<br><small>Avisos sobre sua cota continuam sendo enviados.</small>');
  }
  if (req.method !== 'POST') return json({error: 'Método não suportado'}, 405);

  // rotina diária (pg_cron): lembretes, último dia, aniversários e alerta de parcelas em atraso
  if (req.headers.get('x-cron-secret')) {
    const {data: sec} = await admin.rpc('mail_cron_secret');
    if (!sec || req.headers.get('x-cron-secret') !== sec) return json({error: 'negado'}, 403);
    try { await loadKey(); return json(await runCron()); } catch (e) { return json({error: (e as Error).message}, 500); }
  }

  // autenticação: o próprio usuário logado
  const auth = req.headers.get('Authorization') || '';
  const user = createClient(URL_, ANON, {global: {headers: {Authorization: auth}}, auth: {persistSession: false}});
  let input: any; try { input = await req.json(); } catch { return json({error: 'Requisição inválida'}, 400); }
  const org = String(input.org || '');
  const can = await user.rpc('crm_mail_can', {p_org: org});
  if (can.error) return json({error: can.error.message || 'Sem permissão'}, 403);
  const me = can.data as {user_id: string; name: string};

  try {
    await loadKey();
    if (input.action === 'status') return json({configured: RESEND().length > 0, from: FROM});
    // prévia exata do e-mail (mesmo código do envio)
    if (input.action === 'preview') {
      if (input.mode === 'aviso') {
        const subject = String(input.subject || '').trim() || 'Assunto do comunicado';
        const m = noticeEmail(String(input.name || me.name || 'Equipe'), String(input.category || 'Aviso geral'), subject, String(input.body || '').trim() || 'Escreva a mensagem do comunicado para ver a prévia aqui.');
        return json({subject, html: m.html});
      }
      const kind = String(input.template) as Kind;
      if (!catalog.some(x => x.id === kind)) throw new Error('Escolha um modelo.');
      let r = {name: 'Cliente ALVO', email: '', administrator: 'Canopus', group: '8400', quota: '0123', eventDate: input.eventDate || undefined};
      if (input.caseId) { const aud = await user.rpc('crm_mail_audience', {p_org: org}); const c = (aud.data?.clients || []).find((x: any) => x.case_id === input.caseId);
        if (c) r = {name: c.name, email: c.email, administrator: c.adm || '—', group: c.grp || '—', quota: c.quota || '—', eventDate: input.eventDate || undefined}; }
      const asmPrev: Assembly | undefined = kind === 'assembly-feedback' ? (input.assembly || {held_on: '2026-11-25', adm: 'CNP', grp: '41056', draw_quotas: ['1514', '2187'], bids: [{quota: '4136', pct: 35.5}, {quota: '2728', pct: 32}], min_bid: 32, max_bid: 35.5, summary: 'Resumo oficial enviado pela administradora.', mine: []}) : undefined;
      const m = journeyEmail(kind, r, typeof input.body === 'string' ? input.body.slice(0, 1800) : '', '#', (kind === 'campaign' || kind === 'comunicado') ? campaignOf(input.campaign) : undefined, asmPrev);
      return json({subject: m.subject, html: m.html});
    }
    if (!RESEND()) throw new Error('Envio bloqueado: falta cadastrar a chave do Resend no Supabase (segredo RESEND_API_KEY).');

    // resultado de assembleia: envia para todos os clientes ativos do grupo e avisa o proprietário das cotas que aparecem no resultado
    if (input.action === 'assembly') {
      const {data: a} = await admin.from('assemblies').select('*').eq('id', String(input.id || '')).eq('organization_id', org).maybeSingle();
      if (!a) throw new Error('Assembleia não encontrada.');
      if (a.sent != null) throw new Error('Este resultado já foi enviado.');
      const norm = (v: unknown) => String(v ?? '').trim().toLowerCase().replace(/^0+/, '');
      const {data: act} = await admin.rpc('mail_active_clients', {p_org: org});
      const winners = new Set([...(a.draw_quotas || []), ...((a.bids || []) as any[]).map(b => b.quota)].map(norm));
      const items: any[] = [], matched: any[] = [];
      for (const c of (act || []) as Active[]) {
        const mine = c.cotas.filter(x => norm(x.adm) === norm(a.adm) && norm(x.grp) === norm(a.grp));
        if (!mine.length) continue;
        const hit = mine.filter(x => winners.has(norm(x.quota)));
        hit.forEach(x => matched.push({case_id: x.case_id, client: c.name, quota: x.quota}));
        const asm: Assembly = {held_on: a.held_on, adm: a.adm, grp: a.grp, draw_quotas: a.draw_quotas || [], bids: a.bids || [], min_bid: a.min_bid, max_bid: a.max_bid, summary: a.summary, mine: hit.map(x => x.quota)};
        const m = journeyEmail('assembly-feedback', {name: c.name, email: c.email, administrator: a.adm, group: a.grp, quota: mine.map(x => x.quota).join(' · '), eventDate: a.held_on}, '', undefined, undefined, asm);
        items.push({to: c.email, name: c.name, ref: c.client_id || c.email, subject: m.subject, html: m.html, text: m.text, template: 'assembly-feedback', eventDate: a.held_on, body: 'Assembleia ' + a.adm + ' ' + a.grp});
      }
      const sent = items.length ? await deliver(org, items, me.name) : 0;
      await admin.from('assemblies').update({sent, matched}).eq('id', a.id);
      if (matched.length) {
        const {data: owners} = await admin.from('memberships').select('user_id').eq('organization_id', org).in('role_key', ['PROPRIETARIO']).eq('status', 'ATIVO');
        for (const w of owners || []) for (const x of matched) await admin.from('notifications').insert({organization_id: org, user_id: w.user_id, kind: 'contemplacao', target_view: 'funis', dedupe_key: 'asm:' + a.id + ':' + w.user_id + ':' + x.case_id,
          body: 'Cota ' + x.quota + ' de ' + x.client + ' aparece no resultado da assembleia ' + a.adm + ' ' + a.grp + '. Confirme e registre em Negócios.'});
      }
      return json({ok: true, sent, recipients: items.length, matched, message: sent + ' e-mail(s) enviado(s) para o grupo ' + a.grp + (matched.length ? ' · ' + matched.length + ' cota(s) da carteira no resultado' : '') + '.'});
    }

    if (input.action === 'send') {
      const aud = await user.rpc('crm_mail_audience', {p_org: org});
      if (aud.error) throw aud.error;
      const out: {to: string; name: string; ref: string; subject: string; html: string; text: string; template: string; body?: string; headers?: Record<string,string>}[] = [];
      let skipped = 0;
      if (input.mode === 'cliente') {
        const kind = String(input.template) as Kind, model = catalog.find(x => x.id === kind);
        if (!model) throw new Error('Escolha um modelo.');
        const ids: string[] = Array.isArray(input.caseIds) ? input.caseIds.map(String) : [];
        if (!ids.length || ids.length > 1000) throw new Error('Selecione entre 1 e 1.000 clientes.');
        const body = typeof input.body === 'string' ? input.body.trim().slice(0, 1800) : '';
        const ref = String(input.reference || '').trim();
        if (model.needsRef && ref.length < 8) throw new Error('Informe a evidência ou regra (mín. 8 caracteres) para este modelo.');
        const eventDate = /^20\d{2}-\d\d-\d\d$/.test(input.eventDate || '') ? input.eventDate : undefined;
        const camp = (kind === 'campaign' || kind === 'comunicado') ? campaignOf(input.campaign) : undefined;
        if (camp && (camp.headline || '').trim().length < 5) throw new Error('Informe o título (mín. 5 caracteres).');
        if (kind === 'comunicado' && body.length < 10) throw new Error('Escreva a mensagem do comunicado (mín. 10 caracteres).');
        if ((kind.startsWith('payment') || kind.startsWith('assembly')) && !eventDate) throw new Error('Informe a data real do vencimento/assembleia.');
        const seen = new Set<string>();
        for (const c of (aud.data.clients as any[]).filter(c => ids.includes(c.case_id))) {
          const sk = (kind === 'comunicado' || model.promotional) ? c.email : c.email + c.case_id;
          if (!okEmail(c.email) || seen.has(sk)) { skipped++; continue; }
          if (model.promotional && (!c.marketing_ok || c.opt_out)) { skipped++; continue; }
          if ((kind === 'birthday' || kind === 'comunicado') && c.opt_out) { skipped++; continue; }
          seen.add(sk);
          let unsub: string | undefined;
          if (model.promotional && c.client_id) {
            const {data: cl} = await admin.from('clients').select('metadata').eq('id', c.client_id).single();
            let tok = cl?.metadata?.mail_token;
            if (!tok) { tok = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, ''); await admin.from('clients').update({metadata: {...(cl?.metadata || {}), mail_token: tok}}).eq('id', c.client_id); }
            unsub = URL_ + '/functions/v1/alvo-mail?unsub=' + tok;
          }
          const m = journeyEmail(kind, {name: c.name, email: c.email, administrator: c.adm || '—', group: c.grp || '—', quota: c.quota || '—', eventDate}, body, unsub, camp);
          out.push({to: c.email, name: c.name, ref: c.case_id, subject: m.subject, html: m.html, text: m.text, template: kind, body: body || undefined,
            headers: unsub ? {'List-Unsubscribe': '<' + unsub + '>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'} : undefined});
        }
      } else if (input.mode === 'aviso') {
        const category = String(input.category || ''), subject = String(input.subject || '').trim(), body = String(input.body || '').trim();
        if (!noticeCategories.includes(category)) throw new Error('Escolha a categoria do comunicado.');
        if (subject.length < 5 || subject.length > 150 || /[\r\n]/.test(subject)) throw new Error('O assunto deve ter entre 5 e 150 caracteres.');
        if (body.length < 3 || body.length > 6000) throw new Error('A mensagem deve ter entre 3 e 6.000 caracteres.');
        const ids: string[] = Array.isArray(input.userIds) ? input.userIds.map(String) : [];
        if (!ids.length || ids.length > 300) throw new Error('Selecione entre 1 e 300 pessoas.');
        for (const u of (aud.data.team as any[]).filter(u => ids.includes(u.id))) {
          if (!okEmail(u.email)) { skipped++; continue; }
          const m = noticeEmail(u.name, category, subject, body);
          out.push({to: u.email, name: u.name, ref: u.id, subject, html: m.html, text: m.text, template: category, body});
        }
      } else throw new Error('Tipo de envio inválido.');
      if (!out.length) throw new Error('Nenhum destinatário elegível (sem e-mail válido ou sem autorização de campanhas).');

      // registra antes de enviar (nunca reenviar algo incerto automaticamente)
      const rows = out.map(o => ({organization_id: org, kind: input.mode, template: o.template, ref_id: o.ref, to_name: o.name, to_email: o.to, subject: o.subject, body: o.body || null, event_date: input.eventDate || null, status: 'enviando', sent_by: me.name}));
      const ins = await admin.from('mail_log').insert(rows).select('id');
      if (ins.error) throw ins.error;
      const logIds = ins.data.map((r: any) => r.id);
      let sent = 0, failed = 0, lastErr = '';
      for (let i0 = 0; i0 < out.length; i0 += 100) {
        const part = out.slice(i0, i0 + 100), pids = logIds.slice(i0, i0 + 100);
        try {
          const res = await resend('/emails/batch', {method: 'POST', headers: {'Idempotency-Key': 'alvo-' + pids[0]}, body: JSON.stringify(part.map(o => ({from: FROM, to: [o.to], subject: o.subject, html: o.html, text: o.text, ...(o.headers ? {headers: o.headers} : {})})))});
          const data = Array.isArray(res?.data) ? res.data : [];
          for (let i = 0; i < pids.length; i++) {
            const id = data[i]?.id;
            await admin.from('mail_log').update(id ? {status: 'enviado', provider_id: id, updated_at: new Date().toISOString()} : {status: 'incerto', error: 'Resend não confirmou esta mensagem', updated_at: new Date().toISOString()}).eq('id', pids[i]);
            if (id) sent++;
          }
        } catch (e) {
          const msg = (e as Error).message, sure = /^Resend 4\d\d/.test(msg); lastErr = msg; failed += pids.length;
          await admin.from('mail_log').update({status: sure ? 'falhou' : 'incerto', error: msg, updated_at: new Date().toISOString()}).in('id', pids);
        }
      }
      if (!sent && failed) throw new Error(/^Resend 4\d\d/.test(lastErr) ? lastErr : 'Resposta do Resend não confirmada. Confira no painel do Resend antes de reenviar.');
      if (failed) skipped += failed;
      return json({ok: true, sent, skipped, message: sent + ' e-mail(s) enviado(s)' + (skipped ? '; ' + skipped + ' sem e-mail válido ou sem autorização' : '') + '.'});
    }

    if (input.action === 'refresh') {
      const {data} = await admin.from('mail_log').select('id,provider_id,status').eq('organization_id', org).not('provider_id', 'is', null).in('status', ['enviado', 'entregue', 'aberto']).order('created_at', {ascending: false}).limit(40);
      let n = 0;
      for (const r of data || []) {
        try { const e = await resend('/emails/' + encodeURIComponent(r.provider_id)); const st = mapStatus(String(e?.last_event || 'sent'));
          if (st !== r.status) { await admin.from('mail_log').update({status: st, updated_at: new Date().toISOString()}).eq('id', r.id); n++; } } catch { /* mantém o status */ }
      }
      return json({ok: true, updated: n});
    }
    throw new Error('Ação desconhecida.');
  } catch (e) {
    return json({error: (e as Error).message || 'Falha no envio'}, 400);
  }
});
