-- 18: Campanhas, desafios e premiações (só proprietário/administrador cria; todos veem o que podem)
-- Progresso calculado no front a partir das vendas efetivadas (crm_dashboard), pelo período da campanha.
CREATE TABLE IF NOT EXISTS campaigns (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'campanha' CHECK (kind IN ('campanha','desafio','premiacao')),
  title text NOT NULL, description text,
  metric text NOT NULL DEFAULT 'credito' CHECK (metric IN ('credito','vendas')),
  mode text NOT NULL DEFAULT 'individual' CHECK (mode IN ('individual','coletiva')),
  target numeric NOT NULL CHECK (target>0),
  scope_type text NOT NULL DEFAULT 'ORG' CHECK (scope_type IN ('ORG','TEAM','REGION','USER')),
  scope_id text, reward text,
  starts_on date NOT NULL, ends_on date NOT NULL CHECK (ends_on>=starts_on),
  active boolean NOT NULL DEFAULT true,
  created_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION crm_campaigns(p_org text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE me text := _require(p_org,'metas',1); scope text; myteam text; myreg text;
BEGIN
  SELECT r.data_scope::text, m.team_id, m.region_id INTO scope, myteam, myreg FROM memberships m JOIN org_roles r ON r.organization_id=m.organization_id AND r.role_key=m.role_key
   WHERE m.organization_id=p_org AND m.user_id=me AND m.status='ATIVO';
  RETURN jsonb_build_object('can_edit', perm_level(p_org,'metas')>=3,
   'items', coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.active DESC, c.ends_on DESC) FROM campaigns c WHERE c.organization_id=p_org
     AND (scope='ORGANIZACAO' OR c.scope_type='ORG' OR (c.scope_type='TEAM' AND c.scope_id=myteam) OR (c.scope_type='REGION' AND c.scope_id=myreg)
          OR (c.scope_type='USER' AND (c.scope_id=me OR can_see_owner(p_org,c.scope_id))))),'[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION crm_campaign_save(p_org text, p_id text, p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE me text := _require(p_org,'metas',3); c campaigns;
BEGIN
  IF coalesce(trim(p_data->>'title'),'')='' THEN RAISE EXCEPTION 'Informe o nome'; END IF;
  IF p_id IS NULL OR p_id='' THEN
    INSERT INTO campaigns (organization_id,kind,title,description,metric,mode,target,scope_type,scope_id,reward,starts_on,ends_on,created_by)
    VALUES (p_org,coalesce(p_data->>'kind','campanha'),trim(p_data->>'title'),nullif(trim(p_data->>'description'),''),coalesce(p_data->>'metric','credito'),coalesce(p_data->>'mode','individual'),
      (p_data->>'target')::numeric,coalesce(p_data->>'scope_type','ORG'),nullif(p_data->>'scope_id',''),nullif(trim(p_data->>'reward'),''),(p_data->>'starts_on')::date,(p_data->>'ends_on')::date,me) RETURNING * INTO c;
  ELSE
    UPDATE campaigns SET kind=coalesce(p_data->>'kind',kind), title=coalesce(nullif(trim(p_data->>'title'),''),title), description=CASE WHEN p_data ? 'description' THEN nullif(trim(p_data->>'description'),'') ELSE description END,
      metric=coalesce(p_data->>'metric',metric), mode=coalesce(p_data->>'mode',mode), target=coalesce((p_data->>'target')::numeric,target),
      scope_type=coalesce(p_data->>'scope_type',scope_type), scope_id=CASE WHEN p_data ? 'scope_id' THEN nullif(p_data->>'scope_id','') ELSE scope_id END,
      reward=CASE WHEN p_data ? 'reward' THEN nullif(trim(p_data->>'reward'),'') ELSE reward END,
      starts_on=coalesce((p_data->>'starts_on')::date,starts_on), ends_on=coalesce((p_data->>'ends_on')::date,ends_on),
      active=coalesce((p_data->>'active')::boolean,active), updated_at=now()
    WHERE id=p_id AND organization_id=p_org RETURNING * INTO c;
    IF NOT FOUND THEN RAISE EXCEPTION 'Campanha não encontrada'; END IF;
  END IF;
  RETURN to_jsonb(c);
END $$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY array['crm_campaigns(text)','crm_campaign_save(text,text,jsonb)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP; END $$;
