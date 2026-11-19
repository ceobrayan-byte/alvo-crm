-- 13: Entrada rápida. Uma única chamada traz tudo o que a tela inicial precisa
-- (antes eram ~14 requisições em 4 rodadas, cada uma com ~350 ms de ida e volta até o servidor).
-- SECURITY INVOKER de propósito: as tabelas são lidas com as políticas (RLS) do próprio usuário,
-- exatamente como as consultas que o front fazia uma a uma.
CREATE OR REPLACE FUNCTION crm_boot(p_org text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE me jsonb := crm_me(p_org); org text;
BEGIN
  IF NOT coalesce((me->>'linked')::boolean,false) OR me->>'active_org' IS NULL THEN RETURN jsonb_build_object('me',me); END IF;
  org := me->>'active_org';
  RETURN jsonb_build_object(
    'me', me,
    'org', (SELECT to_jsonb(x) FROM (SELECT id,name,city,plan_key,seats,goal_credit,cycle_start_day FROM organizations WHERE id=org) x),
    'roles', coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT role_key,label,data_scope FROM org_roles WHERE organization_id=org) x),'[]'),
    'perms', coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT role_key,module,level FROM role_permissions WHERE organization_id=org) x),'[]'),
    'screens', coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT role_key,screen,level FROM role_screens WHERE organization_id=org) x),'[]'),
    'teams', coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT id,name FROM teams WHERE organization_id=org) x),'[]'),
    'pipes', coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.sort) FROM (SELECT id,key,name,sort FROM pipelines WHERE organization_id=org) x),'[]'),
    'stages', coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.sort) FROM (SELECT s.id,s.pipeline_id,s.key,s.label,s.sort,s.probability,s.kind FROM pipeline_stages s JOIN pipelines p ON p.id=s.pipeline_id WHERE p.organization_id=org) x),'[]'),
    'team', crm_team(org),
    'leads', coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM (SELECT id,name,phone,email,origin,product_interest,desired_credit,tags,owner_user_id,created_at,updated_at FROM leads WHERE organization_id=org) x),'[]'),
    'deals', coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM (SELECT id,pipeline_id,stage_id,lead_id,owner_user_id,credit_value,temperature,stage_entered_at,lost_reason,won_at,created_at FROM deals WHERE organization_id=org) x),'[]'),
    'tasks', coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM (SELECT id,title,task_type,due_at,status,assigned_user_id,lead_id,deal_id,completed_at FROM tasks WHERE organization_id=org) x),'[]'),
    'xp', coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT user_id,action_key,xp,occurred_on,created_at FROM xp_events WHERE organization_id=org) x),'[]'),
    'invites', coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT id,email,role_key,team_id,status,created_at,expires_at FROM invitations WHERE organization_id=org) x),'[]')
  );
END $$;
REVOKE ALL ON FUNCTION crm_boot(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION crm_boot(text) TO authenticated;
