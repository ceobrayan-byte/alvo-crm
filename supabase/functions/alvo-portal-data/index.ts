// APP ALVO (portal do consorciado) → CRM: fonte única dos dados do cliente.
// Só o servidor do app chama esta função, com o segredo `portal_data_secret` (Vault + Vercel).
// O app envia apenas as vendas aprovadas do cliente logado (VEN-xxxxxx); o CRM resolve o resto.
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {auth: {persistSession: false}});
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), {status: s, headers: {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}});
let secret: string | null = null;

function same(a: string, b: string) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return d === 0;
}
const refsOk = (v: unknown): v is string[] =>
  Array.isArray(v) && v.length >= 1 && v.length <= 20 && v.every(r => typeof r === 'string' && /^VEN-[0-9]{6}$/.test(r));

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({error: 'Método não suportado'}, 405);
  if (!secret) { const {data} = await admin.rpc('portal_data_secret'); secret = typeof data === 'string' ? data : null; }
  const given = req.headers.get('x-portal-secret') || '';
  if (!secret || secret.length < 32 || !same(given, secret)) return json({error: 'negado'}, 403);
  let b: any; try { b = await req.json(); } catch { return json({error: 'inválido'}, 400); }
  if (!refsOk(b?.saleRefs)) return json({error: 'Vínculo inválido'}, 400);
  try {
    if (b.action === 'data') {
      const {data, error} = await admin.rpc('portal_customer_data', {p_sale_refs: b.saleRefs});
      if (error) throw error;
      return json(data);
    }
    if (b.action === 'request') {
      const {data, error} = await admin.rpc('portal_create_request', {p_sale_refs: b.saleRefs, p_case_id: String(b.caseId || ''),
        p_kind: String(b.kind || ''), p_payload: b.payload && typeof b.payload === 'object' ? b.payload : {}, p_email: String(b.email || '')});
      if (error) return json({error: error.message}, error.code === '42501' ? 403 : 400);
      return json(data);
    }
    if (b.action === 'contact') {
      const {data, error} = await admin.rpc('portal_update_contact', {p_sale_refs: b.saleRefs, p_phone: String(b.phone ?? '')});
      if (error) return json({error: error.message}, error.code === '42501' ? 403 : 400);
      return json(data);
    }
    return json({error: 'Ação inválida'}, 400);
  } catch {
    return json({error: 'CRM temporariamente indisponível'}, 503);
  }
});
