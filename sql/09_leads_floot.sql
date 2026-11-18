-- 09: Bloco Leads do Floot (Kanban, ficha, Geladeira, Base fria) — cópia fiel das regras
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS sonho text,
  ADD COLUMN IF NOT EXISTS valor_sonho numeric,
  ADD COLUMN IF NOT EXISTS capacidade numeric,
  ADD COLUMN IF NOT EXISTS last_contact text,
  ADD COLUMN IF NOT EXISTS simulacao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS agendado text,
  ADD COLUMN IF NOT EXISTS chaveamento boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fechou boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS geladeira_desde timestamptz,
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS cold_leads (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  origin text,
  return_owner text,
  last_interaction text,
  reason text,
  entered_at timestamptz NOT NULL DEFAULT now(),
  created_by text
);
CREATE UNIQUE INDEX IF NOT EXISTS cold_leads_org_phone ON cold_leads (organization_id, phone);
ALTER TABLE cold_leads ENABLE ROW LEVEL SECURITY; -- acesso só por funções crm_*

CREATE OR REPLACE FUNCTION _norm_phone(p text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN d IS NULL OR d = '' THEN NULL
    WHEN length(d) IN (10,11) THEN '55'||d
    WHEN length(d) IN (12,13) AND left(d,2)='55' THEN d
    ELSE d END
  FROM (SELECT regexp_replace(coalesce(p,''),'\D','','g') d) s $$;

-- quadro: leads que o usuário vê (os seus/da equipe) + Geladeira compartilhada
CREATE OR REPLACE FUNCTION crm_leads_board(p_org text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE me text := _require(p_org,'contatos',1);
BEGIN
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.created_at DESC) FROM leads l
    WHERE l.organization_id = p_org AND l.status IS DISTINCT FROM 'excluido'
      AND (l.stage = 'Geladeira' OR can_see_owner(p_org, l.owner_user_id))),'[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION crm_lead_save(p_org text, p_id text, p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me text := _require(p_org,'contatos',2); row_ leads; ph text := _norm_phone(p_data->>'phone'); owner_id text;
BEGIN
  IF p_id IS NULL THEN
    IF coalesce(trim(p_data->>'name'),'')='' THEN RAISE EXCEPTION 'Nome é obrigatório'; END IF;
    owner_id := coalesce(nullif(p_data->>'owner_user_id',''), me);
    IF owner_id <> me AND NOT can_see_owner(p_org, owner_id) THEN RAISE EXCEPTION 'Sem permissão para atribuir a este usuário' USING ERRCODE='42501'; END IF;
    INSERT INTO leads (organization_id, owner_user_id, name, phone, email, cpf_cnpj, origin, sonho, valor_sonho, capacidade, stage, simulacao, agendado, chaveamento, last_contact, product_interest, desired_credit)
    VALUES (p_org, owner_id, trim(p_data->>'name'), ph, nullif(trim(p_data->>'email'),''), nullif(trim(p_data->>'cpf_cnpj'),''), p_data->>'origin',
      p_data->>'sonho', nullif(p_data->>'valor_sonho','')::numeric, nullif(p_data->>'capacidade','')::numeric,
      coalesce(nullif(p_data->>'stage',''),'Novo Lead'), coalesce((p_data->>'simulacao')::boolean,false), p_data->>'agendado',
      coalesce((p_data->>'chaveamento')::boolean,false), to_char(now() AT TIME ZONE 'America/Cuiaba','DD/MM/YYYY HH24:MI'),
      p_data->>'sonho', nullif(p_data->>'valor_sonho','')::numeric) RETURNING * INTO row_;
  ELSE
    SELECT * INTO row_ FROM leads WHERE id=p_id AND organization_id=p_org FOR UPDATE;
    IF NOT FOUND OR NOT (row_.stage='Geladeira' OR can_see_owner(p_org,row_.owner_user_id)) THEN RAISE EXCEPTION 'Lead não encontrado' USING ERRCODE='42501'; END IF;
    UPDATE leads SET
      name=coalesce(nullif(trim(p_data->>'name'),''),name), phone=coalesce(ph,phone),
      email=CASE WHEN p_data ? 'email' THEN nullif(trim(p_data->>'email'),'') ELSE email END,
      cpf_cnpj=CASE WHEN p_data ? 'cpf_cnpj' THEN nullif(trim(p_data->>'cpf_cnpj'),'') ELSE cpf_cnpj END,
      origin=coalesce(p_data->>'origin',origin), sonho=coalesce(p_data->>'sonho',sonho),
      valor_sonho=CASE WHEN p_data ? 'valor_sonho' THEN nullif(p_data->>'valor_sonho','')::numeric ELSE valor_sonho END,
      capacidade=CASE WHEN p_data ? 'capacidade' THEN nullif(p_data->>'capacidade','')::numeric ELSE capacidade END,
      simulacao=coalesce((p_data->>'simulacao')::boolean,simulacao), chaveamento=coalesce((p_data->>'chaveamento')::boolean,chaveamento),
      agendado=CASE WHEN p_data ? 'agendado' THEN nullif(p_data->>'agendado','') ELSE agendado END,
      last_contact=to_char(now() AT TIME ZONE 'America/Cuiaba','DD/MM/YYYY HH24:MI'), updated_at=now()
    WHERE id=p_id RETURNING * INTO row_;
  END IF;
  RETURN to_jsonb(row_);
END $$;

-- mover etapa (regras do Floot: Closer define dono; Geladeira marca data; Fechamento bloqueado como destino direto fora de closeSale)
CREATE OR REPLACE FUNCTION crm_lead_move(p_org text, p_id text, p_stage text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me text := _require(p_org,'contatos',2); row_ leads;
BEGIN
  IF p_stage NOT IN ('Novo Lead','SDR / SRV','Closer','Call 1 agendada','No-show / Follow-up Call 1','Simulação recebida','Call 2','Segundo no-show','Fechamento','Geladeira','Suporte / Documentação') THEN
    RAISE EXCEPTION 'Etapa inválida'; END IF;
  SELECT * INTO row_ FROM leads WHERE id=p_id AND organization_id=p_org FOR UPDATE;
  IF NOT FOUND OR NOT (row_.stage='Geladeira' OR can_see_owner(p_org,row_.owner_user_id)) THEN RAISE EXCEPTION 'Lead não encontrado' USING ERRCODE='42501'; END IF;
  UPDATE leads SET stage=p_stage,
    owner_user_id = CASE WHEN p_stage='Closer' AND row_.stage='Geladeira' THEN me ELSE owner_user_id END,
    geladeira_desde = CASE WHEN p_stage='Geladeira' THEN now() ELSE NULL END,
    fechou = CASE WHEN p_stage='Suporte / Documentação' THEN true ELSE fechou END,
    last_contact=to_char(now() AT TIME ZONE 'America/Cuiaba','DD/MM/YYYY HH24:MI'), updated_at=now()
  WHERE id=p_id RETURNING * INTO row_;
  RETURN to_jsonb(row_);
END $$;

CREATE OR REPLACE FUNCTION crm_lead_delete(p_org text, p_id text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me text := _require(p_org,'contatos',3); n int;
BEGIN
  UPDATE leads SET status='excluido', updated_at=now() WHERE id=p_id AND organization_id=p_org AND can_see_owner(p_org,owner_user_id);
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n>0;
END $$;

-- Geladeira: 'claim' puxa para a carteira de quem chama; 'cold' envia para Leads Frios
CREATE OR REPLACE FUNCTION crm_fridge_action(p_org text, p_id text, p_action text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me text := _require(p_org,'contatos',2); row_ leads;
BEGIN
  SELECT * INTO row_ FROM leads WHERE id=p_id AND organization_id=p_org AND stage='Geladeira' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lead não está na Geladeira'; END IF;
  IF p_action='claim' THEN
    UPDATE leads SET owner_user_id=me, stage='Closer', geladeira_desde=NULL, updated_at=now() WHERE id=p_id RETURNING * INTO row_;
    RETURN to_jsonb(row_);
  ELSIF p_action='cold' THEN
    INSERT INTO cold_leads (organization_id,name,phone,email,origin,return_owner,last_interaction,reason,created_by)
    VALUES (p_org,row_.name,coalesce(_norm_phone(row_.phone),'sem-'||row_.id),row_.email,row_.origin,row_.owner_user_id,row_.last_contact,'Enviado da Geladeira',me)
    ON CONFLICT (organization_id,phone) DO NOTHING;
    UPDATE leads SET status='excluido', updated_at=now() WHERE id=p_id;
    RETURN jsonb_build_object('moved','cold');
  END IF;
  RAISE EXCEPTION 'Ação inválida';
END $$;

-- Efetivar venda: abre caso de suporte (stage Suporte / Documentação, fechou = true)
CREATE OR REPLACE FUNCTION crm_lead_close_sale(p_org text, p_id text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me text := _require(p_org,'contatos',2); row_ leads;
BEGIN
  SELECT * INTO row_ FROM leads WHERE id=p_id AND organization_id=p_org FOR UPDATE;
  IF NOT FOUND OR NOT can_see_owner(p_org,row_.owner_user_id) THEN RAISE EXCEPTION 'Lead não encontrado' USING ERRCODE='42501'; END IF;
  UPDATE leads SET fechou=true, stage='Suporte / Documentação', updated_at=now() WHERE id=p_id RETURNING * INTO row_;
  RETURN to_jsonb(row_);
END $$;

-- Base fria
CREATE OR REPLACE FUNCTION crm_cold_list(p_org text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE me text := _require(p_org,'contatos',1);
BEGIN
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.entered_at DESC) FROM cold_leads c WHERE c.organization_id=p_org),'[]'::jsonb);
END $$;

-- importação: p_rows = [{name,phone,email,origin,...}]; p_commit=false só faz a prévia
CREATE OR REPLACE FUNCTION crm_cold_import(p_org text, p_rows jsonb, p_commit boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me text := _require(p_org,'contatos',2); r jsonb; ph text; ok int:=0; dup int:=0; bad int:=0; active int:=0; n int;
BEGIN
  IF jsonb_array_length(p_rows) > 20000 THEN RAISE EXCEPTION 'Arquivo grande demais'; END IF;
  FOR r IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    ph := _norm_phone(r->>'phone');
    IF coalesce(trim(r->>'name'),'')='' OR ph IS NULL THEN bad:=bad+1; CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM leads WHERE organization_id=p_org AND status IS DISTINCT FROM 'excluido' AND _norm_phone(phone)=ph) THEN active:=active+1; CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM cold_leads WHERE organization_id=p_org AND phone=ph) THEN dup:=dup+1; CONTINUE; END IF;
    ok:=ok+1;
    IF p_commit THEN
      INSERT INTO cold_leads (organization_id,name,phone,email,origin,return_owner,last_interaction,reason,created_by)
      VALUES (p_org,trim(r->>'name'),ph,nullif(trim(r->>'email'),''),r->>'origin',r->>'owner_retorno',r->>'ultima_interacao',r->>'motivo',me)
      ON CONFLICT (organization_id,phone) DO NOTHING;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('new',ok,'duplicates',dup,'invalid',bad,'active',active,'committed',p_commit);
END $$;

-- retomar da base fria para a carteira de quem chama
CREATE OR REPLACE FUNCTION crm_cold_resume(p_org text, p_id text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me text := _require(p_org,'contatos',2); c cold_leads; row_ leads;
BEGIN
  DELETE FROM cold_leads WHERE id=p_id AND organization_id=p_org RETURNING * INTO c;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lead frio não encontrado'; END IF;
  INSERT INTO leads (organization_id,owner_user_id,name,phone,email,origin,stage,last_contact)
  VALUES (p_org,me,c.name,c.phone,c.email,c.origin,'Closer',to_char(now() AT TIME ZONE 'America/Cuiaba','DD/MM/YYYY HH24:MI')) RETURNING * INTO row_;
  RETURN to_jsonb(row_);
END $$;

DO $$ DECLARE f text; BEGIN
  FOR f IN SELECT p.oid::regprocedure::text FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND (p.proname LIKE 'crm\_lead%' OR p.proname LIKE 'crm\_cold%' OR p.proname='crm_fridge_action' OR p.proname='_norm_phone') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', f); END IF;
    IF f LIKE 'crm\_%' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f); ELSE EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', f); END IF;
  END LOOP; END $$;
INSERT INTO alvo_schema_versions (version, description) VALUES (9, 'Bloco Leads do Floot: quadro, ficha, Geladeira, Base fria');
