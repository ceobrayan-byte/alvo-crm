-- 16: Dashboard executivo, metas por ciclo e regiões (dados do Floot: metaGlobal, salesGoals, regionalMemberships)
-- Ciclo comercial: dia 15 a 14 (cycle_start_day). Meta "2026-11" = ciclo 15/11/2026–14/12/2026.
ALTER TABLE crm_regions ADD COLUMN IF NOT EXISTS organization_id text REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS region_id text;
INSERT INTO crm_regions (id,name,active,organization_id,updated_at) VALUES
 ('REG-NORTE-MT','Norte do Mato Grosso',true,'ORG-000001',now()),('REG-OESTE-PR','Oeste do Paraná',true,'ORG-000001',now()),
 ('REG-MS','Mato Grosso do Sul',true,'ORG-000001',now()),('REG-SP','São Paulo',true,'ORG-000001',now()),('REG-SEDE','Sede',true,'ORG-000001',now())
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, organization_id=EXCLUDED.organization_id;
UPDATE memberships m SET region_id=v.r FROM (VALUES ('USR-000005','REG-NORTE-MT'),('USR-000008','REG-NORTE-MT'),('USR-000006','REG-MS'),('USR-000009','REG-OESTE-PR'),('USR-000004','REG-SP'),('USR-000001','REG-SEDE')) v(u,r)
 WHERE m.organization_id='ORG-000001' AND m.user_id=v.u;

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS goals_read ON goals;
CREATE POLICY goals_read ON goals FOR SELECT TO authenticated USING (is_member(organization_id));
GRANT SELECT ON goals TO authenticated;
CREATE UNIQUE INDEX IF NOT EXISTS goals_uniq ON goals (organization_id, scope_type, scope_id, period_start, metric);

UPDATE organizations SET goal_credit=6000000 WHERE id='ORG-000001';
INSERT INTO goals (id,organization_id,scope_type,scope_id,period_start,period_end,metric,target_value,metadata,created_at,updated_at)
SELECT gen_random_uuid()::text,'ORG-000001',t,s,p::date,(p::date+interval '1 month'-interval '1 day')::date,'credito',v,'{"origem":"Floot"}'::jsonb,now(),now() FROM (VALUES
 ('ORG','ORG-000001','2026-10-15',6000000),('ORG','ORG-000001','2026-11-15',6000000),
 ('USER','USR-000006','2026-10-15',2000000),('USER','USR-000007','2026-10-15',1000000),('USER','USR-000005','2026-10-15',1000000),
 ('USER','USR-000009','2026-10-15',1000000),('USER','USR-000008','2026-10-15',2000000),('USER','USR-000004','2026-10-15',1000000),
 ('USER','USR-000006','2026-11-15',2000000),('USER','USR-000009','2026-11-15',2000000),('USER','USR-000001','2026-11-15',2000000)
) x(t,s,p,v) ON CONFLICT DO NOTHING;

-- dados do dashboard: vendas efetivadas visíveis ao perfil + equipe, regiões e metas
CREATE OR REPLACE FUNCTION crm_dashboard(p_org text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE me text := _require(p_org,'visao-geral',1); scope text; myteam text;
BEGIN
  SELECT r.data_scope::text, m.team_id INTO scope, myteam FROM memberships m JOIN org_roles r ON r.organization_id=m.organization_id AND r.role_key=m.role_key
   WHERE m.organization_id=p_org AND m.user_id=me AND m.status='ATIVO';
  RETURN jsonb_build_object(
   'scope', scope, 'me', me,
   'cycle_start_day', (SELECT coalesce(cycle_start_day,15) FROM organizations WHERE id=p_org),
   'org_goal', (SELECT goal_credit FROM organizations WHERE id=p_org),
   'sales', coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'seller',c.seller_user_id,'credit',c.credit,'date',coalesce(c.sale_date,c.created_at::date),'adm',c.admin,'product',c.product,'client',c.client_name) ORDER BY c.sale_date)
     FROM op_cases c WHERE c.organization_id=p_org AND c.returned_at IS NULL AND c.status='Efetivado' AND (c.seller_user_id=me OR can_see_owner(p_org,c.seller_user_id))),'[]'::jsonb),
   'members', coalesce((SELECT jsonb_agg(jsonb_build_object('id',u.id,'name',u.display_name,'role',m.role_key,'team_id',m.team_id,'region_id',m.region_id,'status',m.status))
     FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.organization_id=p_org AND (scope='ORGANIZACAO' OR m.user_id=me OR (scope='EQUIPE' AND myteam IS NOT NULL AND m.team_id=myteam))),'[]'::jsonb),
   'teams', coalesce((SELECT jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'coordinator',(SELECT m.user_id FROM memberships m WHERE m.team_id=t.id AND m.role_key='GESTOR' LIMIT 1))) FROM teams t WHERE t.organization_id=p_org AND (scope='ORGANIZACAO' OR t.id=myteam)),'[]'::jsonb),
   'regions', coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'name',r.name)) FROM crm_regions r WHERE r.organization_id=p_org AND r.active),'[]'::jsonb),
   'goals', coalesce((SELECT jsonb_agg(jsonb_build_object('scope_type',g.scope_type,'scope_id',g.scope_id,'start',g.period_start,'end',g.period_end,'target',g.target_value))
     FROM goals g WHERE g.organization_id=p_org AND g.metric='credito' AND (scope='ORGANIZACAO' OR g.scope_type IN ('ORG','TEAM') OR g.scope_id=me OR can_see_owner(p_org,g.scope_id))),'[]'::jsonb));
END $$;

-- metas: só dono/administrador (metas nível 3)
CREATE OR REPLACE FUNCTION crm_goal_save(p_org text, p_scope_type text, p_scope_id text, p_start date, p_target numeric) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE me text := _require(p_org,'metas',3); g goals;
BEGIN
  IF p_scope_type NOT IN ('ORG','USER','TEAM','REGION') THEN RAISE EXCEPTION 'Tipo de meta inválido'; END IF;
  IF p_target IS NULL OR p_target<0 THEN RAISE EXCEPTION 'Informe um valor válido'; END IF;
  INSERT INTO goals (id,organization_id,scope_type,scope_id,period_start,period_end,metric,target_value,metadata,created_at,updated_at)
  VALUES (gen_random_uuid()::text,p_org,p_scope_type,p_scope_id,p_start,(p_start+interval '1 month'-interval '1 day')::date,'credito',p_target,jsonb_build_object('by',me),now(),now())
  ON CONFLICT (organization_id,scope_type,scope_id,period_start,metric) DO UPDATE SET target_value=EXCLUDED.target_value, metadata=goals.metadata||jsonb_build_object('by',me), updated_at=now()
  RETURNING * INTO g;
  IF p_scope_type='ORG' THEN UPDATE organizations SET goal_credit=p_target WHERE id=p_org; END IF;
  RETURN to_jsonb(g);
END $$;

-- região do membro (dono/administrador)
CREATE OR REPLACE FUNCTION crm_member_region(p_org text, p_user text, p_region text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE me text := _require(p_org,'equipe',3);
BEGIN
  IF p_region IS NOT NULL AND p_region<>'' AND NOT EXISTS (SELECT 1 FROM crm_regions WHERE id=p_region AND organization_id=p_org) THEN RAISE EXCEPTION 'Região inválida'; END IF;
  UPDATE memberships SET region_id=nullif(p_region,'') WHERE organization_id=p_org AND user_id=p_user;
  RETURN jsonb_build_object('user_id',p_user,'region_id',nullif(p_region,''));
END $$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY array['crm_dashboard(text)','crm_goal_save(text,text,text,date,numeric)','crm_member_region(text,text,text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP; END $$;
