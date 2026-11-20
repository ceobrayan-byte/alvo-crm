-- 19: Dashboard e metas idênticos ao Floot (fonte da verdade até a virada)
-- * Venda = caso Efetivado COM regra e data de venda (no Floot só conta o que tem registro em "sales").
--   Rafael Moises (3 cotas) e Paulo Brincker SUP-000060 estão efetivados sem venda registrada → fora do dashboard.
-- * Ciclo inicial do ranking: 01/10/2026 a 14/11/2026 (chave 2026-10-01). Depois: dia 15 ao dia 14.
-- * Meta da empresa = soma das metas individuais (sem meta "ORG" fixa).
-- * Vendedoras ativas no Floot sem cadastro aqui: Evely, Lidiane (equipe Neiva / MS) e Vanessa (sede).

-- vendedoras que faltavam (sem login ainda; o convite é feito pela tela Equipe)
INSERT INTO users (display_name,corporate_email,phone,role,status,metadata)
SELECT n,e,p,'VENDEDOR','ATIVO',jsonb_build_object('floot_id',f) FROM (VALUES
 ('Evely Ranna Lima Santos','evelyranna@gmail.com','67984145179','USR-866c9fb8-0729-4bfd-8983-16c905c42de0'),
 ('Lidiane Rodrigues','lidiane.lrv2018@gmail.com','65996179136','USR-dc218d05-cd52-4627-8732-018093a39184'),
 ('Vanessa','vanessadesouza_live@hotmail.com','66999367588','USR-c0d60da7-dcdd-45c4-bc7f-5c2ba39e92a7')) x(n,e,p,f)
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE lower(u.corporate_email)=lower(x.e));
INSERT INTO memberships (organization_id,user_id,role_key,team_id,region_id,status,is_seller)
SELECT 'ORG-000001',u.id,'VENDEDOR',CASE WHEN u.corporate_email LIKE 'vanessa%' THEN NULL ELSE 'TEAM-NEIVA' END,CASE WHEN u.corporate_email LIKE 'vanessa%' THEN 'REG-SEDE' ELSE 'REG-MS' END,'ATIVO',true
FROM users u WHERE u.corporate_email IN ('evelyranna@gmail.com','lidiane.lrv2018@gmail.com','vanessadesouza_live@hotmail.com')
AND NOT EXISTS (SELECT 1 FROM memberships m WHERE m.user_id=u.id AND m.organization_id='ORG-000001');

-- Debora está inativa no Floot
UPDATE memberships SET status='INATIVO' WHERE organization_id='ORG-000001' AND user_id='USR-000007';

-- ciclo inicial começa em 01/10
UPDATE goals SET period_start='2026-10-01', period_end='2026-11-14' WHERE organization_id='ORG-000001' AND period_start='2026-10-15';
-- metas ORG antigas ficam guardadas, mas não são mais usadas (o dashboard lê só metas individuais)

-- metas do ciclo 15/11–14/12 iguais ao Floot (salesGoals 2026-11; quem não tem valor herda a meta-base)
INSERT INTO goals (id,organization_id,scope_type,scope_id,period_start,period_end,metric,target_value,metadata,created_at,updated_at)
SELECT gen_random_uuid()::text,'ORG-000001','USER',u.id,'2026-11-15','2026-12-14','credito',v,'{"by":"Floot"}',now(),now()
FROM (VALUES ('USR-000008',1000000),('USR-000005',1000000),('USR-000004',0),
  ((SELECT id FROM users WHERE corporate_email='evelyranna@gmail.com'),1000000),
  ((SELECT id FROM users WHERE corporate_email='lidiane.lrv2018@gmail.com'),1000000),
  ((SELECT id FROM users WHERE corporate_email='vanessadesouza_live@hotmail.com'),0)) x(uid,v)
JOIN users u ON u.id=x.uid
ON CONFLICT (organization_id,scope_type,scope_id,period_start,metric) DO UPDATE SET target_value=EXCLUDED.target_value;
-- ciclo inicial: Escritório 0 (igual ao Floot)
INSERT INTO goals (id,organization_id,scope_type,scope_id,period_start,period_end,metric,target_value,metadata,created_at,updated_at)
VALUES (gen_random_uuid()::text,'ORG-000001','USER','USR-000001','2026-10-01','2026-11-14','credito',0,'{"by":"Floot"}',now(),now())
ON CONFLICT (organization_id,scope_type,scope_id,period_start,metric) DO NOTHING;

-- dashboard: só vendas registradas; fim do ciclo calculado no front
CREATE OR REPLACE FUNCTION crm_dashboard(p_org text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE me text := _require(p_org,'visao-geral',1); scope text; myteam text;
BEGIN
  SELECT r.data_scope::text, m.team_id INTO scope, myteam FROM memberships m JOIN org_roles r ON r.organization_id=m.organization_id AND r.role_key=m.role_key
   WHERE m.organization_id=p_org AND m.user_id=me AND m.status='ATIVO';
  RETURN jsonb_build_object(
   'scope', scope, 'me', me,
   'cycle_start_day', (SELECT coalesce(cycle_start_day,15) FROM organizations WHERE id=p_org),
   'sales', coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'seller',c.seller_user_id,'credit',c.credit,'date',c.sale_date,'adm',c.admin,'product',c.product,'client',c.client_name,'grp',c.grp,'quota',c.quota) ORDER BY c.sale_date, c.id)
     FROM op_cases c WHERE c.organization_id=p_org AND c.returned_at IS NULL AND c.status='Efetivado' AND c.rule_id IS NOT NULL AND c.sale_date IS NOT NULL AND c.credit>0
       AND c.sale_date<=(now() AT TIME ZONE 'America/Cuiaba')::date
       AND (c.seller_user_id=me OR can_see_owner(p_org,c.seller_user_id))),'[]'::jsonb),
   'members', coalesce((SELECT jsonb_agg(jsonb_build_object('id',u.id,'name',u.display_name,'role',m.role_key,'team_id',m.team_id,'region_id',m.region_id,'status',m.status))
     FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.organization_id=p_org AND (scope='ORGANIZACAO' OR m.user_id=me OR (scope='EQUIPE' AND myteam IS NOT NULL AND m.team_id=myteam))),'[]'::jsonb),
   'teams', coalesce((SELECT jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'coordinator',(SELECT m.user_id FROM memberships m WHERE m.team_id=t.id AND m.role_key='GESTOR' AND m.status='ATIVO' LIMIT 1))) FROM teams t WHERE t.organization_id=p_org AND (scope='ORGANIZACAO' OR t.id=myteam)),'[]'::jsonb),
   'regions', coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'name',r.name)) FROM crm_regions r WHERE r.organization_id=p_org AND r.active),'[]'::jsonb),
   'goals', coalesce((SELECT jsonb_agg(jsonb_build_object('scope_type',g.scope_type,'scope_id',g.scope_id,'start',g.period_start,'end',g.period_end,'target',g.target_value))
     FROM goals g WHERE g.organization_id=p_org AND g.metric='credito' AND g.scope_type='USER' AND (scope='ORGANIZACAO' OR g.scope_id=me OR can_see_owner(p_org,g.scope_id))),'[]'::jsonb));
END $$;

-- período da meta: ciclo inicial termina em 14/11; os demais vão do dia 15 ao dia 14
CREATE OR REPLACE FUNCTION crm_goal_save(p_org text, p_scope_type text, p_scope_id text, p_start date, p_target numeric) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE me text := _require(p_org,'metas',3); g goals;
BEGIN
  IF p_scope_type<>'USER' THEN RAISE EXCEPTION 'A meta da empresa é a soma das metas individuais'; END IF;
  IF p_target IS NULL OR p_target<0 THEN RAISE EXCEPTION 'Informe um valor válido'; END IF;
  INSERT INTO goals (id,organization_id,scope_type,scope_id,period_start,period_end,metric,target_value,metadata,created_at,updated_at)
  VALUES (gen_random_uuid()::text,p_org,p_scope_type,p_scope_id,p_start,CASE WHEN p_start='2026-10-01' THEN '2026-11-14'::date ELSE (p_start+interval '1 month'-interval '1 day')::date END,'credito',p_target,jsonb_build_object('by',me),now(),now())
  ON CONFLICT (organization_id,scope_type,scope_id,period_start,metric) DO UPDATE SET target_value=EXCLUDED.target_value, metadata=goals.metadata||jsonb_build_object('by',me), updated_at=now()
  RETURNING * INTO g;
  RETURN to_jsonb(g);
END $$;
