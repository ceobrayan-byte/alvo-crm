// Setor de e-mails da ALVO: envia pelo Resend (remetente suporte@alvoinvestimentos.com) e registra em mail_log.
// A chave do Resend fica só aqui (segredo RESEND_API_KEY). Quem pode usar: perfis com Suporte nível 3 (dono, admin, suporte).
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import { catalog, noticeCategories, journeyEmail, noticeEmail, type Kind, type Campaign } from './templates.ts';

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
      const m = journeyEmail(kind, r, typeof input.body === 'string' ? input.body.slice(0, 1800) : '', '#', kind === 'campaign' ? campaignOf(input.campaign) : undefined);
      return json({subject: m.subject, html: m.html});
    }
    if (!RESEND()) throw new Error('Envio bloqueado: falta cadastrar a chave do Resend no Supabase (segredo RESEND_API_KEY).');

    if (input.action === 'send') {
      const aud = await user.rpc('crm_mail_audience', {p_org: org});
      if (aud.error) throw aud.error;
      const out: {to: string; name: string; ref: string; subject: string; html: string; text: string; template: string; body?: string; headers?: Record<string,string>}[] = [];
      let skipped = 0;
      if (input.mode === 'cliente') {
        const kind = String(input.template) as Kind, model = catalog.find(x => x.id === kind);
        if (!model) throw new Error('Escolha um modelo.');
        const ids: string[] = Array.isArray(input.caseIds) ? input.caseIds.map(String) : [];
        if (!ids.length || ids.length > 100) throw new Error('Selecione entre 1 e 100 clientes.');
        const body = typeof input.body === 'string' ? input.body.trim().slice(0, 1800) : '';
        const ref = String(input.reference || '').trim();
        if (model.needsRef && ref.length < 8) throw new Error('Informe a evidência ou regra (mín. 8 caracteres) para este modelo.');
        const eventDate = /^20\d{2}-\d\d-\d\d$/.test(input.eventDate || '') ? input.eventDate : undefined;
        const camp = kind === 'campaign' ? campaignOf(input.campaign) : undefined;
        if (camp && (camp.headline || '').trim().length < 5) throw new Error('Informe o título da campanha (mín. 5 caracteres).');
        if ((kind.startsWith('payment') || kind.startsWith('assembly')) && !eventDate) throw new Error('Informe a data real do vencimento/assembleia.');
        const seen = new Set<string>();
        for (const c of (aud.data.clients as any[]).filter(c => ids.includes(c.case_id))) {
          if (!okEmail(c.email) || seen.has(c.email + c.case_id)) { skipped++; continue; }
          if (model.promotional && (!c.marketing_ok || c.opt_out)) { skipped++; continue; }
          if (kind === 'birthday' && c.opt_out) { skipped++; continue; }
          seen.add(c.email + c.case_id);
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
        if (!ids.length || ids.length > 100) throw new Error('Selecione entre 1 e 100 pessoas.');
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
      let sent = 0;
      try {
        const res = await resend('/emails/batch', {method: 'POST', headers: {'Idempotency-Key': 'alvo-' + logIds[0]}, body: JSON.stringify(out.map(o => ({from: FROM, to: [o.to], subject: o.subject, html: o.html, text: o.text, ...(o.headers ? {headers: o.headers} : {})})))});
        const data = Array.isArray(res?.data) ? res.data : [];
        for (let i = 0; i < logIds.length; i++) {
          const id = data[i]?.id;
          await admin.from('mail_log').update(id ? {status: 'enviado', provider_id: id, updated_at: new Date().toISOString()} : {status: 'incerto', error: 'Resend não confirmou esta mensagem', updated_at: new Date().toISOString()}).eq('id', logIds[i]);
          if (id) sent++;
        }
      } catch (e) {
        const msg = (e as Error).message, sure = /^Resend 4\d\d/.test(msg);
        await admin.from('mail_log').update({status: sure ? 'falhou' : 'incerto', error: msg, updated_at: new Date().toISOString()}).in('id', logIds);
        throw new Error(sure ? msg : 'Resposta do Resend não confirmada. Confira no painel do Resend antes de reenviar.');
      }
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
