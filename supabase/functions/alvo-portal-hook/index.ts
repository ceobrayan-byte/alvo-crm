// Recebe do APP ALVO (portal do consorciado) cada pedido novo ou mudança de situação e
// registra no CRM (portal_requests), avisando proprietário, administradores e suporte no sino.
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {auth: {persistSession: false}});
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), {status: s, headers: {'Content-Type': 'application/json'}});
const ORG = 'ORG-000001';
const KIND: Record<string, string> = {boleto: 'segunda via de boleto', lance: 'oferta de lance'};
const brl = (v: unknown) => Number(v || 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({error: 'Método não suportado'}, 405);
  const {data: sec} = await admin.rpc('portal_hook_secret');
  if (!sec || req.headers.get('x-portal-secret') !== sec) return json({error: 'negado'}, 403);
  let b: any; try { b = await req.json(); } catch { return json({error: 'inválido'}, 400); }
  if (!b?.id || !/^[0-9a-f-]{36}$/i.test(String(b.id))) return json({error: 'inválido'}, 400);
  const {data: map} = b.crm_quota_id ? await admin.from('portal_sale_map').select('case_id').eq('sale_ref', String(b.crm_quota_id)).maybeSingle() : {data: null};
  const {data: prev} = await admin.from('portal_requests').select('id,status').eq('id', b.id).maybeSingle();
  const row: Record<string, unknown> = {id: b.id, organization_id: ORG, protocol: b.protocol ?? null, kind: b.type ?? null, status: b.status ?? null,
    payload: b.payload || {}, reason: b.reason ?? null, created_at: b.created_at ?? null, updated_at: new Date().toISOString()};
  if (b.crm_quota_id) row.sale_ref = String(b.crm_quota_id);
  if (b.crm_customer_id) row.client_ref = String(b.crm_customer_id);
  if (b.email) row.email = String(b.email);
  if (b.quota) row.quota = b.quota;
  if (map?.case_id) row.case_id = map.case_id;
  const up = await admin.from('portal_requests').upsert(row);
  if (up.error) return json({error: up.error.message}, 500);
  if (!prev) {
    let client = b.quota?.holderName || b.email || 'Cliente';
    if (map?.case_id) { const {data: c} = await admin.from('op_cases').select('client_name').eq('id', map.case_id).maybeSingle(); if (c?.client_name) client = c.client_name; }
    const what = KIND[b.type] || 'solicitação';
    const extra = b.type === 'lance' && b.payload?.amount ? ' de ' + brl(b.payload.amount) + (b.payload.percent ? ' (' + String(b.payload.percent).replace('.', ',') + '%)' : '') : '';
    const {data: people} = await admin.from('memberships').select('user_id').eq('organization_id', ORG).eq('status', 'ATIVO').in('role_key', ['PROPRIETARIO', 'ADMINISTRADOR', 'SUPORTE']);
    for (const p of people || []) await admin.from('notifications').insert({organization_id: ORG, user_id: p.user_id, kind: 'portal', target_view: 'app-clientes',
      dedupe_key: 'portal:' + b.id + ':' + p.user_id, body: 'APP ALVO: ' + client + ' pediu ' + what + extra + (b.protocol ? ' · protocolo ' + b.protocol : '') + '.'});
  }
  return json({ok: true});
});
