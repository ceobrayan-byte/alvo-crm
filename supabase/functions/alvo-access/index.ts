// Acesso da equipe ao CRM: o proprietário/administrador gera uma senha provisória para a pessoa,
// o CRM cria (ou atualiza) o login dela e envia por e-mail com o link certo. No 1º acesso ela troca a senha.
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP = 'https://crm.alvoinvestimentos.com.br';
const FROM = 'ALVO Investimentos <suporte@alvoinvestimentos.com>';
const cors = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS'};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), {status: s, headers: {...cors, 'Content-Type': 'application/json'}});
const admin = createClient(URL_, SERVICE, {auth: {persistSession: false}});
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c] || c));

function tempPassword() {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ', a = 'abcdefghjkmnpqrstuvwxyz', d = '23456789', all = A + a + d;
  const r = crypto.getRandomValues(new Uint32Array(8));
  let p = A[r[0] % A.length] + a[r[1] % a.length] + d[r[2] % d.length];
  for (let i = 3; i < 8; i++) p += all[r[i] % all.length];
  return 'Alvo-' + p;
}
function accessEmail(name: string, email: string, pw: string) {
  const first = esc(name.trim().split(/\s+/)[0] || 'Olá');
  const F = "font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const html = '<!DOCTYPE html><html lang="pt-BR"><body style="margin:0;background:#ECE7DC"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ECE7DC"><tr><td align="center" style="padding:28px 12px">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#fff;border-radius:22px;overflow:hidden">' +
    '<tr><td bgcolor="#06261F" style="background:#06261F;background-image:linear-gradient(140deg,#06261F,#0F4A3C 62%,#1A5E4C);padding:28px 34px"><img src="' + APP + '/brand/logo-ivory.png" width="130" alt="ALVO Investimentos" style="display:block;border:0"><h1 style="margin:26px 0 0;font-family:Georgia,serif;font-weight:400;font-size:28px;color:#FFF9EC">Seu acesso ao CRM ALVO</h1><p style="margin:10px 0 0;' + F + ';font-size:15px;color:#CFE2D9">A plataforma comercial nova da ALVO já está no ar.</p></td></tr>' +
    '<tr><td style="height:5px;font-size:0;background:#C48A2C">&nbsp;</td></tr>' +
    '<tr><td style="padding:30px 34px;' + F + ';color:#43514A;font-size:15px;line-height:1.7"><p style="margin:0 0 14px;font-size:17px;color:#16201C">Olá, <b>' + first + '</b>!</p>' +
    '<p style="margin:0 0 18px">Use os dados abaixo para entrar. No primeiro acesso o CRM vai pedir para você criar a sua senha definitiva. A senha antiga do sistema anterior não vale mais.</p>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F4EE;border-radius:14px"><tr><td style="padding:16px 18px"><div style="font-size:11px;letter-spacing:1.4px;color:#7A867F">E-MAIL</div><div style="font-size:16px;font-weight:700;color:#0F4A3C">' + esc(email) + '</div>' +
    '<div style="font-size:11px;letter-spacing:1.4px;color:#7A867F;margin-top:12px">SENHA PROVISÓRIA</div><div style="font-size:20px;font-weight:700;color:#0F4A3C;letter-spacing:1px;font-family:Consolas,monospace">' + esc(pw) + '</div></td></tr></table>' +
    '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto 6px"><tr><td bgcolor="#C48A2C" style="border-radius:12px;background:#C48A2C"><a href="' + APP + '" style="display:inline-block;padding:15px 32px;' + F + ';font-size:15px;font-weight:700;color:#06261F;text-decoration:none">Entrar no CRM &rarr;</a></td></tr></table>' +
    '<p style="margin:18px 0 0;font-size:13px;color:#7A867F;text-align:center">' + APP.replace('https://', '') + '</p></td></tr>' +
    '<tr><td bgcolor="#06261F" style="background:#06261F;padding:20px 34px;' + F + ';font-size:12px;color:#BFD3C9">Dúvidas: suporte@alvoinvestimentos.com · Não compartilhe sua senha.</td></tr></table></td></tr></table></body></html>';
  const text = 'Olá, ' + name + '!\n\nSeu acesso ao CRM ALVO:\nEndereço: ' + APP + '\nE-mail: ' + email + '\nSenha provisória: ' + pw + '\n\nNo primeiro acesso você vai criar sua senha definitiva.';
  return {html, text};
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', {headers: cors});
  if (req.method !== 'POST') return json({error: 'Método não suportado'}, 405);
  let input: any; try { input = await req.json(); } catch { return json({error: 'Requisição inválida'}, 400); }
  let org = String(input.org || ''); const uid = String(input.user_id || '');
  // chamada interna (rotina do banco, autenticada pelo segredo do cofre): envia acesso sem devolver a senha
  const forgot = input.action === 'forgot';
  const internal = forgot || !!req.headers.get('x-cron-secret');
  let target: {id: string; name: string; email: string; auth_user_id: string | null};
  if (forgot) {
    // "Esqueci minha senha" na tela de login: só para quem está ativo na equipe; resposta sempre igual; 1 envio a cada 10 min por e-mail
    const em = String(input.email || '').trim().toLowerCase();
    const okMsg = {ok: true, message: 'Se o e-mail estiver cadastrado na equipe, você vai receber uma senha provisória em instantes. Confira também o spam.'};
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return json(okMsg);
    const {data: r} = await admin.from('users').select('id,display_name,corporate_email,auth_user_id,memberships!inner(status,organization_id)').eq('corporate_email', em).eq('memberships.status', 'ATIVO').limit(1).maybeSingle();
    if (!r) return json(okMsg);
    const since = new Date(Date.now() - 10 * 60e3).toISOString();
    const {count} = await admin.from('mail_log').select('id', {count: 'exact', head: true}).eq('template', 'acesso').eq('to_email', em).gte('created_at', since);
    if ((count || 0) > 0) return json(okMsg);
    const m0 = (r as any).memberships[0];
    input.org = m0.organization_id;
    target = {id: r.id, name: r.display_name, email: r.corporate_email, auth_user_id: r.auth_user_id};
    (input as any)._okMsg = okMsg;
  } else if (internal) {
    const {data: sec} = await admin.rpc('mail_cron_secret');
    if (!sec || req.headers.get('x-cron-secret') !== sec) return json({error: 'negado'}, 403);
    const {data: r} = await admin.from('users').select('id,display_name,corporate_email,auth_user_id,memberships!inner(status,role_key,organization_id)').eq('id', uid).eq('memberships.organization_id', org).maybeSingle();
    const m = (r as any)?.memberships?.[0];
    if (!r || !m || m.status !== 'ATIVO' || m.role_key === 'PROPRIETARIO' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.corporate_email || '')) return json({error: 'Pessoa inválida para envio'}, 400);
    target = {id: r.id, name: r.display_name, email: r.corporate_email, auth_user_id: r.auth_user_id};
  } else {
    const user = createClient(URL_, ANON, {global: {headers: {Authorization: req.headers.get('Authorization') || ''}}, auth: {persistSession: false}});
    const t = await user.rpc('crm_access_target', {p_org: org, p_user: uid});
    if (t.error) return json({error: t.error.message}, 403);
    target = t.data as {id: string; name: string; email: string; auth_user_id: string | null};
  }
  org = String(input.org || org);
  const email = target.email.trim().toLowerCase(), pw = tempPassword();
  try {
    let authId = target.auth_user_id;
    if (authId) {
      const {error} = await admin.auth.admin.updateUserById(authId, {password: pw, email_confirm: true, user_metadata: {temp_pw: true, name: target.name}});
      if (error) throw error;
    } else {
      const c = await admin.auth.admin.createUser({email, password: pw, email_confirm: true, user_metadata: {temp_pw: true, name: target.name}});
      if (c.error) {
        // já existe um login com este e-mail: localiza e reaproveita
        let found: string | null = null;
        for (let page = 1; page <= 10 && !found; page++) {
          const l = await admin.auth.admin.listUsers({page, perPage: 200});
          if (l.error) throw l.error;
          found = (l.data.users.find(u => (u.email || '').toLowerCase() === email) || {id: null} as any).id;
          if (l.data.users.length < 200) break;
        }
        if (!found) throw c.error;
        const {error} = await admin.auth.admin.updateUserById(found, {password: pw, email_confirm: true, user_metadata: {temp_pw: true, name: target.name}});
        if (error) throw error;
        authId = found;
      } else authId = c.data.user!.id;
      const {error: le} = await admin.from('users').update({auth_user_id: authId}).eq('id', target.id);
      if (le) throw le;
    }
    let sent = false, mailError: string | null = null;
    if (input.send_email !== false) {
      const {data: key} = await admin.rpc('mail_resend_key');
      if (key) {
        const m = accessEmail(target.name, email, pw);
        const r = await fetch('https://api.resend.com/emails', {method: 'POST', headers: {Authorization: 'Bearer ' + key, 'Content-Type': 'application/json'},
          body: JSON.stringify({from: FROM, to: [email], subject: 'Seu acesso ao CRM ALVO', html: m.html, text: m.text})});
        const p = await r.json().catch(() => ({}));
        sent = r.ok; if (!r.ok) mailError = 'Resend ' + r.status + ': ' + (p?.message || 'erro');
        await admin.from('mail_log').insert({organization_id: org, kind: 'aviso', template: 'acesso', ref_id: target.id, to_name: target.name, to_email: email,
          subject: 'Seu acesso ao CRM ALVO', body: 'Acesso enviado (senha provisória não registrada)', status: r.ok ? 'enviado' : 'falhou', provider_id: p?.id || null, error: mailError, sent_by: forgot ? 'Esqueci minha senha' : internal ? 'Envio automático' : 'Equipe e permissões'});
      } else mailError = 'Chave do Resend não configurada';
    }
    if (forgot) return json((input as any)._okMsg);
    return json(internal ? {ok: true, email, sent, mailError} : {ok: true, email, password: pw, sent, mailError, url: APP});
  } catch (e) {
    return json({error: (e as Error).message || 'Falha ao criar o acesso'}, 400);
  }
});
