-- =====================================================================
-- ALVO CRM — MIGRAÇÃO DOS VENDEDORES E OPORTUNIDADES EXISTENTES
-- Roda depois de 07. Traz para o CRM novo o que já existia no alvo-crm:
--   * seller_users (9 pessoas)  -> users + memberships (VENDEDOR; o admin vira o Proprietário já criado)
--   * crm_opportunities (59)    -> leads + deals no funil Comercial, etapa "Novo lead", cada um com o seu dono
-- As tabelas antigas (seller_users, crm_opportunities, simulations, consultant_links...) NÃO são alteradas.
-- É idempotente: pode rodar de novo sem duplicar (usa o id antigo como chave).
-- Os logins (auth.users) são criados à parte, com senha provisória; ver 08b (não versionado: contém segredos).
-- =====================================================================

-- 1) o admin antigo é o Proprietário do CRM novo
UPDATE users
   SET metadata = metadata || jsonb_build_object('legacy_seller_id', (SELECT id FROM seller_users WHERE role = 'admin' ORDER BY created_at LIMIT 1)),
       updated_at = now()
 WHERE lower(corporate_email) = 'ceo.brayan@alvoinvestimentos.com'
   AND NOT (metadata ? 'legacy_seller_id');

-- 2) demais vendedores
INSERT INTO users (display_name, corporate_email, role, status, metadata)
SELECT s.display_name, lower(s.email), 'VENDEDOR',
       CASE WHEN s.active THEN 'ATIVO' ELSE 'INATIVO' END::user_status,
       jsonb_build_object('legacy_seller_id', s.id)
  FROM seller_users s
 WHERE s.role <> 'admin'
ON CONFLICT (corporate_email) DO NOTHING;

INSERT INTO memberships (organization_id, user_id, role_key, job_title, is_seller, status)
SELECT 'ORG-000001', u.id, 'VENDEDOR', 'Consultor', true, CASE WHEN u.status = 'ATIVO' THEN 'ATIVO' ELSE 'INATIVO' END
  FROM users u
 WHERE u.metadata ? 'legacy_seller_id'
   AND lower(u.corporate_email) <> 'ceo.brayan@alvoinvestimentos.com'
   AND NOT EXISTS (SELECT 1 FROM memberships m WHERE m.organization_id = 'ORG-000001' AND m.user_id = u.id);

-- 3) oportunidades -> contatos
INSERT INTO leads (organization_id, owner_user_id, name, phone, origin, stage, desired_credit, product_interest, legacy_id, created_at, updated_at, source_data)
SELECT 'ORG-000001', u.id, trim(o.client), nullif(regexp_replace(coalesce(o.phone, ''), '\D', '', 'g'), ''),
       'Simulador', 'novo', greatest(o.credit, 0),
       CASE WHEN o.status ILIKE '%imóvel%' OR o.status ILIKE '%imovel%' THEN 'Imóvel' END,
       'opp:' || o.id, o.created_at, o.created_at, jsonb_build_object('legacy_status', o.status, 'legacy_owner_id', o.owner_id)
  FROM crm_opportunities o
  JOIN users u ON u.metadata ->> 'legacy_seller_id' = o.owner_id
ON CONFLICT (legacy_id) DO NOTHING;

-- 4) contatos migrados -> negócios no funil Comercial
INSERT INTO deals (organization_id, pipeline_id, stage_id, lead_id, owner_user_id, credit_value, temperature, stage_entered_at, created_at)
SELECT l.organization_id, p.id, s.id, l.id, l.owner_user_id, coalesce(l.desired_credit, 0), 'MORNO', l.created_at, l.created_at
  FROM leads l
  JOIN pipelines p ON p.organization_id = l.organization_id AND p.key = 'comercial'
  JOIN pipeline_stages s ON s.pipeline_id = p.id AND s.key = 'novo'
 WHERE l.legacy_id LIKE 'opp:%'
   AND NOT EXISTS (SELECT 1 FROM deals d WHERE d.lead_id = l.id);

INSERT INTO deal_stage_history (deal_id, from_stage_id, to_stage_id, changed_by)
SELECT d.id, NULL, d.stage_id, d.owner_user_id
  FROM deals d JOIN leads l ON l.id = d.lead_id
 WHERE l.legacy_id LIKE 'opp:%'
   AND NOT EXISTS (SELECT 1 FROM deal_stage_history h WHERE h.deal_id = d.id);

INSERT INTO alvo_schema_versions (version, description) VALUES (6, 'Migração dos vendedores e oportunidades do alvo-crm para o CRM novo');
