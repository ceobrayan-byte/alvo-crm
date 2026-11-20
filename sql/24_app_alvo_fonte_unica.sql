-- 24 · APP ALVO (portal do consorciado) passa a ler TUDO do CRM: fonte única.
-- Cotas, parcelas confirmadas, assembleias (histórico e agenda), cadastro e solicitações
-- saem daqui. O app só guarda o login e o vínculo aprovado (VEN-xxxxxx) de cada cliente.
-- Migração aditiva: nada é apagado; nenhum e-mail ou mensagem é disparado.

-- 1) assembleias: detalhes do resultado agregado e origem do registro
ALTER TABLE assemblies ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}';
ALTER TABLE assemblies ADD COLUMN IF NOT EXISTS origin text;
CREATE UNIQUE INDEX IF NOT EXISTS assemblies_historico_app_uniq
  ON assemblies(organization_id, adm, grp, held_on) WHERE origin = 'historico-app';

-- 2) agenda de assembleias (previsões e datas confirmadas), separada dos resultados
CREATE TABLE IF NOT EXISTS assembly_schedule (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  adm text NOT NULL, grp text NOT NULL, held_on date NOT NULL, time_local text,
  status text NOT NULL, confirmed boolean NOT NULL DEFAULT false, source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, adm, grp, held_on)
);
ALTER TABLE assembly_schedule ENABLE ROW LEVEL SECURITY;  -- sem políticas: só funções SECURITY DEFINER

-- 3) segredo servidor-servidor do APP ALVO (valor só no Vault e na Vercel)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'portal_data_secret') THEN
    PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'portal_data_secret',
      'APP ALVO → CRM: leitura e solicitações do portal do consorciado');
  END IF;
END $$;
CREATE OR REPLACE FUNCTION portal_data_secret() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'portal_data_secret' $$;

-- 4) clientes do CRM vinculados às vendas aprovadas no app
CREATE OR REPLACE FUNCTION _portal_client_ids(p_sale_refs text[]) RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT array_agg(DISTINCT c.customer_id)
  FROM portal_sale_map m JOIN op_cases c ON c.id = m.case_id
  WHERE m.sale_ref = ANY (coalesce(p_sale_refs, '{}')) AND c.customer_id IS NOT NULL
    AND c.organization_id = 'ORG-000001'
    AND coalesce(array_length(p_sale_refs, 1), 0) BETWEEN 1 AND 20
    AND NOT EXISTS (SELECT 1 FROM unnest(p_sale_refs) r WHERE r !~ '^VEN-[0-9]{6}$')
$$;

CREATE OR REPLACE FUNCTION _portal_cpf_mask(p text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE length(d)
    WHEN 11 THEN '***.' || substr(d, 4, 3) || '.' || substr(d, 7, 3) || '-**'
    WHEN 14 THEN '**.' || substr(d, 3, 3) || '.' || substr(d, 6, 3) || '/****-**'
    ELSE 'Não informado' END
  FROM (SELECT regexp_replace(coalesce(p, ''), '\D', '', 'g') AS d) x
$$;

-- 5) leitura completa da carteira do cliente
CREATE OR REPLACE FUNCTION portal_customer_data(p_sale_refs text[]) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE cl text[] := _portal_client_ids(p_sale_refs); res jsonb;
BEGIN
  IF cl IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'sem_vinculo'); END IF;
  WITH cs AS (
    SELECT c.*, m.sale_ref FROM op_cases c LEFT JOIN portal_sale_map m ON m.case_id = c.id
    WHERE c.customer_id = ANY (cl) AND c.status = 'Efetivado' AND c.organization_id = 'ORG-000001'
  ), gs AS (SELECT DISTINCT lower(trim(admin)) a, lower(trim(grp)) g FROM cs)
  SELECT jsonb_build_object(
    'ok', true, 'source', 'CRM_ALVO', 'generatedAt', now(),
    'client', (SELECT jsonb_build_object('name', k.name, 'phone', k.phone, 'email', k.email, 'cpfMask', _portal_cpf_mask(k.cpf_cnpj))
               FROM clients k WHERE k.id = ANY (cl) ORDER BY k.created_at LIMIT 1),
    'quotas', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', cs.id, 'saleRef', cs.sale_ref, 'product', cs.product, 'administrator', cs.admin, 'group', cs.grp,
        'quota', cs.quota, 'credit', cs.credit, 'term', cs.term, 'saleDate', cs.sale_date, 'updatedAt', cs.updated_at,
        'paid', coalesce((SELECT jsonb_agg(jsonb_build_object('n', i.n, 'competence', i.competence, 'paidOn', i.paid_on) ORDER BY i.n)
                          FROM fin_installments i WHERE i.case_id = cs.id AND i.confirmed), '[]'::jsonb)
      ) ORDER BY cs.sale_date, cs.id) FROM cs), '[]'::jsonb),
    'assemblies', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'administrator', a.adm, 'group', a.grp, 'date', a.held_on, 'origin', a.origin,
        'status', coalesce(a.details->>'status', 'Resultado publicado pela ALVO'),
        'source', coalesce(a.details->>'source', a.evidence), 'summary', a.summary, 'minBid', a.min_bid,
        'draw', coalesce((a.details->>'draw')::int, nullif(cardinality(a.draw_quotas), 0)),
        'bid', coalesce((a.details->>'bid')::int, nullif(jsonb_array_length(a.bids), 0)),
        'scope', a.details->>'scope') ORDER BY a.held_on DESC)
      FROM assemblies a JOIN gs ON gs.a = lower(trim(a.adm)) AND gs.g = lower(trim(a.grp))
      WHERE a.organization_id = 'ORG-000001'), '[]'::jsonb),
    'schedule', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', s.id, 'administrator', s.adm, 'group', s.grp, 'date', s.held_on, 'time', s.time_local,
        'status', s.status, 'confirmed', s.confirmed, 'source', s.source) ORDER BY s.held_on)
      FROM assembly_schedule s JOIN gs ON gs.a = lower(trim(s.adm)) AND gs.g = lower(trim(s.grp))
      WHERE s.organization_id = 'ORG-000001' AND s.held_on >= current_date - 45), '[]'::jsonb),
    'requests', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'protocol', r.protocol, 'kind', r.kind, 'status', r.status, 'payload', r.payload,
        'reason', r.reason, 'note', r.note, 'caseId', r.case_id, 'createdAt', r.created_at, 'updatedAt', r.updated_at) ORDER BY r.created_at DESC)
      FROM portal_requests r WHERE r.case_id IN (SELECT id FROM cs)), '[]'::jsonb)
  ) INTO res;
  RETURN res;
END $$;

-- 6) nova solicitação do cliente (boleto ou lance), registrada direto no CRM
CREATE OR REPLACE FUNCTION portal_create_request(p_sale_refs text[], p_case_id text, p_kind text, p_payload jsonb, p_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cl text[] := _portal_client_ids(p_sale_refs); c op_cases; r portal_requests; amt numeric; pct numeric; pl jsonb := '{}'; what text; extra text := '';
BEGIN
  IF cl IS NULL THEN RAISE EXCEPTION 'Cliente sem vínculo aprovado' USING ERRCODE = '42501'; END IF;
  SELECT * INTO c FROM op_cases WHERE id = p_case_id AND customer_id = ANY (cl) AND status = 'Efetivado' AND organization_id = 'ORG-000001';
  IF NOT FOUND THEN RAISE EXCEPTION 'Cota não encontrada para este cliente' USING ERRCODE = '42501'; END IF;
  IF p_kind NOT IN ('boleto', 'lance') THEN RAISE EXCEPTION 'Tipo de solicitação inválido'; END IF;
  IF p_kind = 'lance' THEN
    amt := (p_payload->>'amount')::numeric; pct := (p_payload->>'percent')::numeric;
    IF amt IS NULL OR pct IS NULL OR amt <= 0 OR pct <= 0 OR pct > 100 OR amt > c.credit
       OR abs(amt - c.credit * pct / 100) > greatest(0.02, c.credit * 0.0000005 + 0.01) THEN
      RAISE EXCEPTION 'Valor e percentual do lance inconsistentes';
    END IF;
    IF coalesce(p_payload->>'mode', '') <> 'Recursos próprios' THEN RAISE EXCEPTION 'Modalidade ainda não homologada'; END IF;
    pl := jsonb_build_object('amount', amt, 'percent', pct, 'mode', 'Recursos próprios',
      'assemblyId', left(coalesce(p_payload->>'assemblyId', ''), 80), 'assemblyDate', left(coalesce(p_payload->>'assemblyDate', ''), 10));
  END IF;
  SELECT * INTO r FROM portal_requests WHERE case_id = c.id AND kind = p_kind AND status IN ('Recebida', 'Em atendimento', 'Em análise') ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('ok', true, 'duplicate', true, 'request', to_jsonb(r)); END IF;
  INSERT INTO portal_requests (id, organization_id, protocol, kind, status, payload, sale_ref, client_ref, email, quota, case_id, created_at, updated_at)
  SELECT gen_random_uuid(), 'ORG-000001',
    'ALV-' || to_char(now() AT TIME ZONE 'America/Cuiaba', 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
    p_kind, 'Recebida', pl, m.sale_ref, c.customer_id, left(lower(trim(coalesce(p_email, ''))), 254),
    jsonb_build_object('administrator', c.admin, 'group', c.grp, 'quota', c.quota, 'holderName', c.client_name, 'credit', c.credit),
    c.id, now(), now()
  FROM (SELECT (SELECT sale_ref FROM portal_sale_map WHERE case_id = c.id LIMIT 1) AS sale_ref) m
  RETURNING * INTO r;
  what := CASE p_kind WHEN 'boleto' THEN 'segunda via de boleto' ELSE 'oferta de lance' END;
  IF p_kind = 'lance' THEN extra := ' de ' || to_char(amt, 'FM"R$ "999G999G990D00') || ' (' || replace(pct::text, '.', ',') || '%)'; END IF;
  INSERT INTO notifications (organization_id, user_id, kind, target_view, dedupe_key, body)
  SELECT 'ORG-000001', ms.user_id, 'portal', 'app-clientes', 'portal:' || r.id || ':' || ms.user_id,
    'APP ALVO: ' || coalesce(c.client_name, 'Cliente') || ' pediu ' || what || extra || ' · protocolo ' || r.protocol || '.'
  FROM memberships ms WHERE ms.organization_id = 'ORG-000001' AND ms.status = 'ATIVO' AND ms.role_key IN ('PROPRIETARIO', 'ADMINISTRADOR', 'SUPORTE')
  ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'request', to_jsonb(r));
END $$;

-- 7) cliente atualiza o próprio telefone/WhatsApp (nome e e-mail só pela equipe)
CREATE OR REPLACE FUNCTION portal_update_contact(p_sale_refs text[], p_phone text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cl text[] := _portal_client_ids(p_sale_refs); ph text := trim(coalesce(p_phone, ''));
BEGIN
  IF cl IS NULL THEN RAISE EXCEPTION 'Cliente sem vínculo aprovado' USING ERRCODE = '42501'; END IF;
  IF length(ph) > 25 OR (ph <> '' AND length(regexp_replace(ph, '\D', '', 'g')) NOT BETWEEN 10 AND 13) THEN RAISE EXCEPTION 'Telefone inválido'; END IF;
  UPDATE clients SET phone = nullif(ph, ''), updated_at = now() WHERE id = ANY (cl);
  RETURN jsonb_build_object('ok', true);
END $$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY array['portal_data_secret()', '_portal_client_ids(text[])', 'portal_customer_data(text[])',
    'portal_create_request(text[],text,text,jsonb,text)', 'portal_update_contact(text[],text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP; END $$;

-- 8) agenda: mesma regra operacional usada no app (dia 15; sábado → 17; domingo → 16), nov/2026 a out/2027
INSERT INTO assembly_schedule (organization_id, adm, grp, held_on, status, confirmed, source)
SELECT 'ORG-000001', g.adm, g.grp,
  CASE extract(isodow FROM d15) WHEN 6 THEN d15 + 2 WHEN 7 THEN d15 + 1 ELSE d15 END,
  'Previsão ALVO — confirmação pendente', false,
  'Agenda operacional ALVO: dia 15; sábado passa para dia 17; domingo passa para dia 16. Sujeito à confirmação da administradora.'
FROM (VALUES ('Canopus','8122'),('Canopus','8123'),('Canopus','8400'),('CNP','41043'),('CNP','41056'),
             ('CNP','52134'),('Porto','I0498'),('Servopa','1575'),('Servopa','1577')) g(adm, grp)
CROSS JOIN LATERAL (SELECT (date '2026-11-15' + make_interval(months => k))::date AS d15 FROM generate_series(0, 11) k) m
ON CONFLICT (organization_id, adm, grp, held_on) DO NOTHING;

-- 9) histórico de resultados (19 assembleias) que existia só no app: ver 24b_historico_assembleias_app.sql
