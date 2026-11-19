-- 17: Gestão de comissionamento (aba administrativa do Financeiro Comercial)
-- * Acordos por vendedor/administradora importados do Floot (commissionAgreements, últimos ativos).
-- * Política: níveis do coordenador (Floot: 0,02% / 0,03% / 0,06% / 0,10% sobre o crédito dos outros vendedores da equipe,
--   conforme atingimento da meta da equipe), exceções por coordenador e níveis progressivos dos vendedores.
-- * Receita ALVO (regras das administradoras, commission_catalog.alvo_events) NÃO é alterada por nada daqui.
-- * Só o PROPRIETÁRIO configura.

INSERT INTO commission_agreements (organization_id,seller_user_id,platform,percent,effective_from,note)
SELECT 'ORG-000001',s,p,v,d::date,'Importado do Floot ('||d||')' FROM (VALUES
 ('USR-000006','CNP',1.5,'2026-10-27'),('USR-000006','Servopa',0.8,'2026-10-28'),('USR-000006','Âncora',2,'2026-10-27'),
 ('USR-000008','Canopus',2,'2026-10-27'),('USR-000008','CNP',1.5,'2026-10-27'),('USR-000008','Servopa',0.8,'2026-10-28'),('USR-000008','Âncora',2,'2026-10-27'),
 ('USR-000005','Canopus',2,'2026-10-27'),('USR-000005','CNP',1.5,'2026-10-27'),('USR-000005','Servopa',0.8,'2026-10-28'),('USR-000005','Âncora',2,'2026-10-27'),
 ('USR-000009','Canopus',2,'2026-10-27'),('USR-000009','CNP',1.5,'2026-10-27'),('USR-000009','Servopa',0.8,'2026-10-30'),('USR-000009','Âncora',2,'2026-10-27'),
 ('USR-000004','Canopus',2,'2026-10-30'),('USR-000004','CNP',1.5,'2026-10-30'),('USR-000004','Servopa',0.8,'2026-10-30')
) x(s,p,v,d)
WHERE NOT EXISTS (SELECT 1 FROM commission_agreements a WHERE a.seller_user_id=x.s AND a.platform=x.p AND a.active);

CREATE TABLE IF NOT EXISTS commission_policy (
  organization_id text PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  data jsonb NOT NULL, updated_by text, updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE commission_policy ENABLE ROW LEVEL SECURITY;
INSERT INTO commission_policy (organization_id,data,updated_by) VALUES ('ORG-000001', jsonb_build_object(
  'coordinator', jsonb_build_object('below_percent',0.02,'tiers',jsonb_build_array(
      jsonb_build_object('attainment',100,'percent',0.03),jsonb_build_object('attainment',120,'percent',0.06),jsonb_build_object('attainment',150,'percent',0.10)),
    'base','credito efetivado dos outros vendedores da equipe','new_seller_goal',1000000,'goal_increase',0.2,
    'source','Floot · política de coordenação 30/10/2026'),
  'coordinator_overrides', '{}'::jsonb,
  'seller_tiers', '[]'::jsonb
), 'migração Floot') ON CONFLICT (organization_id) DO NOTHING;

CREATE OR REPLACE FUNCTION _is_owner(p_org text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM memberships WHERE organization_id=p_org AND user_id=my_user_id() AND status='ATIVO' AND role_key='PROPRIETARIO') $$;

CREATE OR REPLACE FUNCTION crm_commission_admin(p_org text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE me text := _require(p_org,'suporte',3);
BEGIN
  RETURN jsonb_build_object(
   'owner', _is_owner(p_org),
   'policy', (SELECT data FROM commission_policy WHERE organization_id=p_org),
   'agreements', coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC) FROM commission_agreements a WHERE a.organization_id=p_org),'[]'::jsonb),
   'catalog', coalesce((SELECT jsonb_agg(jsonb_build_object('id',k.id,'platform',k.platform,'product',k.product,'plan',k.plan,'commission_rate',k.commission_rate,'events',k.events,'alvo_kind',k.alvo_kind,'alvo_events',k.alvo_events) ORDER BY k.platform,k.id) FROM commission_catalog k WHERE k.active),'[]'::jsonb),
   'sellers', coalesce((SELECT jsonb_agg(jsonb_build_object('id',u.id,'name',u.display_name,'role',m.role_key,'team_id',m.team_id) ORDER BY u.display_name) FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.organization_id=p_org AND m.status='ATIVO' AND m.role_key NOT IN ('SUPORTE','FINANCEIRO')),'[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION crm_commission_policy_save(p_org text, p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE me text := _require(p_org,'equipe',3); t jsonb; prev numeric := -1;
BEGIN
  IF NOT _is_owner(p_org) THEN RAISE EXCEPTION 'Somente o proprietário configura o comissionamento' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(p_data->'coordinator'->'tiers')<>'array' OR jsonb_typeof(p_data->'seller_tiers')<>'array' THEN RAISE EXCEPTION 'Política inválida'; END IF;
  FOR t IN SELECT * FROM jsonb_array_elements(p_data->'coordinator'->'tiers') LOOP
    IF (t->>'attainment')::numeric<=prev OR (t->>'percent')::numeric<0 OR (t->>'percent')::numeric>5 THEN RAISE EXCEPTION 'Faixas do coordenador devem ser crescentes e com percentuais entre 0 e 5'; END IF;
    prev := (t->>'attainment')::numeric;
  END LOOP;
  UPDATE commission_policy SET data=p_data, updated_by=me, updated_at=now() WHERE organization_id=p_org;
  IF NOT FOUND THEN INSERT INTO commission_policy (organization_id,data,updated_by) VALUES (p_org,p_data,me); END IF;
  RETURN p_data;
END $$;

-- acordos individuais: agora só o proprietário (antes: qualquer perfil com Equipe nível 3)
CREATE OR REPLACE FUNCTION crm_fin_agreement_save(p_org text, p_seller text, p_platform text, p_percent numeric, p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE me text := _require(p_org,'equipe',3); a commission_agreements; cid text;
BEGIN
  IF NOT _is_owner(p_org) THEN RAISE EXCEPTION 'Somente o proprietário altera a comissão dos vendedores' USING ERRCODE='42501'; END IF;
  IF p_percent IS NULL OR p_percent<0 OR p_percent>100 THEN RAISE EXCEPTION 'Percentual individual inválido'; END IF;
  IF NOT EXISTS (SELECT 1 FROM memberships WHERE organization_id=p_org AND user_id=p_seller AND status='ATIVO') THEN RAISE EXCEPTION 'Vendedor inválido'; END IF;
  -- histórico preservado: acordos anteriores continuam valendo para as vendas da época (só se substitui um acordo do mesmo dia)
  UPDATE commission_agreements SET active=false WHERE organization_id=p_org AND seller_user_id=p_seller AND lower(platform)=lower(p_platform) AND active AND effective_from=(now() AT TIME ZONE 'America/Cuiaba')::date;
  INSERT INTO commission_agreements (organization_id,seller_user_id,platform,percent,effective_from,note,created_by) VALUES (p_org,p_seller,p_platform,p_percent,(now() AT TIME ZONE 'America/Cuiaba')::date,nullif(trim(p_note),''),me) RETURNING * INTO a;
  -- vale para vendas a partir de hoje (igual ao Floot); recalcula só o que ainda é previsto dessas vendas; a receita ALVO segue a regra da administradora (mesma fórmula, mesmo calendário)
  FOR cid IN SELECT o.id FROM op_cases o JOIN commission_catalog k ON k.id=o.rule_id WHERE o.organization_id=p_org AND o.seller_user_id=p_seller AND lower(k.platform)=lower(p_platform) AND o.status='Efetivado' AND o.returned_at IS NULL AND o.sale_date>=(now() AT TIME ZONE 'America/Cuiaba')::date LOOP
    PERFORM _fin_generate(cid);
  END LOOP;
  RETURN to_jsonb(a);
END $$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY array['crm_commission_admin(text)','crm_commission_policy_save(text,jsonb)','crm_fin_agreement_save(text,text,text,numeric,text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
  REVOKE ALL ON FUNCTION _is_owner(text) FROM PUBLIC, anon;
END $$;
