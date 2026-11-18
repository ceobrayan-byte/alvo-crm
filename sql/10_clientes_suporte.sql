-- 10: Clientes, Suporte / Operacional e Efetivação (cópia das regras do Floot)
CREATE TABLE IF NOT EXISTS op_cases (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id text, customer_id text,
  seller_user_id text,
  client_name text NOT NULL, cpf_cnpj text, phone text, email text,
  product text, admin text, grp text, quota text, credit numeric, term int, contract text, rule_id text, sale_date date,
  status text NOT NULL DEFAULT 'Documentação pendente',
  docs text NOT NULL DEFAULT 'Pendente',
  first_payment text NOT NULL DEFAULT 'Pendente',
  signed boolean NOT NULL DEFAULT false,
  accepted boolean NOT NULL DEFAULT false,
  manual boolean NOT NULL DEFAULT false,
  returned_at timestamptz,
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS op_cases_org ON op_cases (organization_id, seller_user_id);
ALTER TABLE op_cases ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION _is_office(p_org text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT perm_level(p_org,'suporte') >= 3 $$;

CREATE OR REPLACE FUNCTION _doc_norm(p text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT nullif(regexp_replace(coalesce(p,''),'\D','','g'),'') $$;

CREATE OR REPLACE FUNCTION _case_visible(p_org text, c op_cases) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT c.organization_id = p_org AND (perm_level(p_org,'suporte')>=3 OR c.seller_user_id = my_user_id() OR can_see_owner(p_org, c.seller_user_id)) $$;

-- cliente: acha por CPF/CNPJ ou telefone, senão cria
CREATE OR REPLACE FUNCTION _client_for(p_org text, p_name text, p_doc text, p_phone text, p_email text, p_owner text, p_lead text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cid text; d text := _doc_norm(p_doc); ph text := _norm_phone(p_phone);
BEGIN
  IF d IS NOT NULL THEN SELECT id INTO cid FROM clients WHERE organization_id=p_org AND _doc_norm(cpf_cnpj)=d LIMIT 1; END IF;
  IF cid IS NULL AND ph IS NOT NULL THEN SELECT id INTO cid FROM clients WHERE organization_id=p_org AND _norm_phone(phone)=ph LIMIT 1; END IF;
  IF cid IS NULL THEN
    INSERT INTO clients (id, organization_id, lead_id, owner_user_id, name, cpf_cnpj, phone, email, status)
    VALUES (gen_random_uuid()::text, p_org, p_lead, p_owner, p_name, d, ph, nullif(p_email,''), 'ATIVO') RETURNING id INTO cid;
  END IF;
  RETURN cid;
END $$;

-- Efetivar venda: marca o lead e abre o caso de suporte (status Documentação pendente)
CREATE OR REPLACE FUNCTION crm_lead_close_sale(p_org text, p_id text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE me text := _require(p_org,'contatos',2); row_ leads; cid text; c op_cases;
BEGIN
  SELECT * INTO row_ FROM leads WHERE id=p_id AND organization_id=p_org FOR UPDATE;
  IF NOT FOUND OR NOT can_see_owner(p_org,row_.owner_user_id) THEN RAISE EXCEPTION 'Lead não encontrado' USING ERRCODE='42501'; END IF;
  IF EXISTS (SELECT 1 FROM op_cases WHERE lead_id=p_id AND returned_at IS NULL) THEN RAISE EXCEPTION 'Esta venda já foi efetivada'; END IF;
  cid := _client_for(p_org,row_.name,row_.cpf_cnpj,row_.phone,row_.email,row_.owner_user_id,row_.id);
  INSERT INTO op_cases (organization_id,lead_id,customer_id,seller_user_id,client_name,cpf_cnpj,phone,email,product,credit,sale_date,created_by,history)
  VALUES (p_org,row_.id,cid,row_.owner_user_id,row_.name,_doc_norm(row_.cpf_cnpj),row_.phone,row_.email,row_.sonho,row_.valor_sonho,
    (now() AT TIME ZONE 'America/Cuiaba')::date,me,jsonb_build_array(jsonb_build_object('at',now(),'by',me,'what','Venda efetivada no Kanban'))) RETURNING * INTO c;
  UPDATE leads SET fechou=true, stage='Suporte / Documentação', updated_at=now() WHERE id=p_id RETURNING * INTO row_;
  RETURN jsonb_build_object('lead',to_jsonb(row_),'case',to_jsonb(c));
END $$;

CREATE OR REPLACE FUNCTION crm_cases_list(p_org text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE me text := _require(p_org,'suporte',1);
BEGIN
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.created_at DESC) FROM op_cases c WHERE c.returned_at IS NULL AND _case_visible(p_org,c)),'[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION crm_case_update(p_org text, p_id text, p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE me text := _require(p_org,'suporte',3); c op_cases; changed text[] := '{}'; k text;
BEGIN
  SELECT * INTO c FROM op_cases WHERE id=p_id AND organization_id=p_org AND returned_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Caso não encontrado'; END IF;
  IF (p_data ? 'admin' OR p_data ? 'grp' OR p_data ? 'quota') AND coalesce(trim(p_data->>'reason'),'')='' AND (c.admin IS NOT NULL OR c.grp IS NOT NULL OR c.quota IS NOT NULL)
     AND ((p_data ? 'admin' AND (p_data->>'admin') IS DISTINCT FROM c.admin) OR (p_data ? 'grp' AND (p_data->>'grp') IS DISTINCT FROM c.grp) OR (p_data ? 'quota' AND (p_data->>'quota') IS DISTINCT FROM c.quota)) THEN
    RAISE EXCEPTION 'Informe o motivo da correção de administradora, grupo ou cota'; END IF;
  IF p_data ? 'status' AND (p_data->>'status') NOT IN ('Documentação pendente','Em análise','Aguardando pagamento','Efetivado') THEN RAISE EXCEPTION 'Situação inválida'; END IF;
  IF p_data ? 'docs' AND (p_data->>'docs') NOT IN ('Pendente','Completo') THEN RAISE EXCEPTION 'Documentação inválida'; END IF;
  IF p_data ? 'first_payment' AND (p_data->>'first_payment') NOT IN ('Pendente','Pago') THEN RAISE EXCEPTION '1ª parcela inválida'; END IF;
  IF coalesce(p_data->>'status',c.status)='Efetivado' AND NOT (coalesce((p_data->>'docs'),c.docs)='Completo' AND coalesce((p_data->>'signed')::boolean,c.signed) AND coalesce((p_data->>'accepted')::boolean,c.accepted)) THEN
    RAISE EXCEPTION 'Para efetivar, a documentação precisa estar completa, assinada e aceita'; END IF;
  IF coalesce(NULLIF(p_data->>'group',''),'x')='' THEN NULL; END IF;
  UPDATE op_cases SET
    status=coalesce(p_data->>'status',status), docs=coalesce(p_data->>'docs',docs), first_payment=coalesce(p_data->>'first_payment',first_payment),
    signed=coalesce((p_data->>'signed')::boolean,signed), accepted=coalesce((p_data->>'accepted')::boolean,accepted),
    admin=CASE WHEN p_data ? 'admin' THEN nullif(trim(p_data->>'admin'),'') ELSE admin END,
    grp=CASE WHEN p_data ? 'grp' THEN nullif(trim(p_data->>'grp'),'') ELSE grp END,
    quota=CASE WHEN p_data ? 'quota' THEN nullif(trim(p_data->>'quota'),'') ELSE quota END,
    contract=CASE WHEN p_data ? 'contract' THEN nullif(trim(p_data->>'contract'),'') ELSE contract END,
    product=CASE WHEN p_data ? 'product' THEN nullif(trim(p_data->>'product'),'') ELSE product END,
    term=CASE WHEN p_data ? 'term' THEN nullif(p_data->>'term','')::int ELSE term END,
    credit=CASE WHEN p_data ? 'credit' THEN nullif(p_data->>'credit','')::numeric ELSE credit END,
    sale_date=CASE WHEN p_data ? 'sale_date' THEN nullif(p_data->>'sale_date','')::date ELSE sale_date END,
    history=history||jsonb_build_array(jsonb_build_object('at',now(),'by',me,'what',coalesce(nullif(trim(p_data->>'reason'),''),'Atualização do caso'),'changes',p_data-'reason')),
    updated_at=now()
  WHERE id=p_id RETURNING * INTO c;
  RETURN to_jsonb(c);
END $$;

CREATE OR REPLACE FUNCTION crm_case_return(p_org text, p_id text, p_stage text, p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE me text := _require(p_org,'suporte',3); c op_cases; l leads;
BEGIN
  IF p_stage NOT IN ('Fechamento','Call 2','Call 1 agendada','Simulação recebida','Closer') THEN RAISE EXCEPTION 'Etapa de retorno inválida'; END IF;
  IF coalesce(trim(p_reason),'')='' THEN RAISE EXCEPTION 'Informe o motivo do retorno'; END IF;
  SELECT * INTO c FROM op_cases WHERE id=p_id AND organization_id=p_org AND returned_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Caso não encontrado'; END IF;
  UPDATE op_cases SET returned_at=now(), history=history||jsonb_build_array(jsonb_build_object('at',now(),'by',me,'what','Devolvido ao Kanban ('||p_stage||'): '||trim(p_reason))), updated_at=now() WHERE id=p_id;
  UPDATE leads SET stage=p_stage, fechou=false, updated_at=now() WHERE id=c.lead_id AND organization_id=p_org RETURNING * INTO l;
  RETURN to_jsonb(l);
END $$;

CREATE OR REPLACE FUNCTION crm_case_duplicate(p_org text, p_id text, p_grp text, p_quota text, p_credit numeric, p_sale_date date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE me text := _require(p_org,'suporte',3); c op_cases; n op_cases;
BEGIN
  IF coalesce(trim(p_quota),'')='' THEN RAISE EXCEPTION 'Informe a nova cota'; END IF;
  IF p_credit IS NULL OR p_credit<=0 THEN RAISE EXCEPTION 'Informe um crédito positivo'; END IF;
  SELECT * INTO c FROM op_cases WHERE id=p_id AND organization_id=p_org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Caso não encontrado'; END IF;
  IF EXISTS (SELECT 1 FROM op_cases WHERE organization_id=p_org AND coalesce(grp,'')=coalesce(trim(p_grp),'') AND quota=trim(p_quota) AND admin IS NOT DISTINCT FROM c.admin) THEN
    RAISE EXCEPTION 'Este grupo e cota já possuem operação na administradora'; END IF;
  INSERT INTO op_cases (organization_id,lead_id,customer_id,seller_user_id,client_name,cpf_cnpj,phone,email,product,admin,grp,quota,credit,term,rule_id,sale_date,created_by,history)
  VALUES (p_org,c.lead_id,c.customer_id,c.seller_user_id,c.client_name,c.cpf_cnpj,c.phone,c.email,c.product,c.admin,nullif(trim(p_grp),''),trim(p_quota),p_credit,c.term,c.rule_id,coalesce(p_sale_date,current_date),me,
    jsonb_build_array(jsonb_build_object('at',now(),'by',me,'what','Nova cota criada a partir de '||c.id))) RETURNING * INTO n;
  RETURN to_jsonb(n);
END $$;

CREATE OR REPLACE FUNCTION crm_case_manual(p_org text, p_data jsonb, p_mode text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE me text := _require(p_org,'suporte',3); c op_cases; cid text; seller text := p_data->>'seller_user_id'; complete boolean := p_mode='register';
BEGIN
  IF p_mode NOT IN ('draft','register') THEN RAISE EXCEPTION 'Selecione salvar rascunho ou registrar venda'; END IF;
  IF length(coalesce(trim(p_data->>'client_name'),''))<2 THEN RAISE EXCEPTION 'Informe o nome completo do cliente'; END IF;
  IF seller IS NULL OR NOT EXISTS (SELECT 1 FROM memberships WHERE organization_id=p_org AND user_id=seller AND status='ATIVO') THEN RAISE EXCEPTION 'Selecione um vendedor ativo'; END IF;
  IF length(coalesce(p_data->>'phone',''))<8 THEN RAISE EXCEPTION 'Informe o telefone de contato do cliente'; END IF;
  IF complete AND (coalesce(p_data->>'admin','')='' OR coalesce(p_data->>'product','')='' OR coalesce(p_data->>'grp','')='' OR coalesce(p_data->>'quota','')='' OR coalesce(p_data->>'term','')='' OR coalesce(p_data->>'credit','')='' OR coalesce(p_data->>'sale_date','')='' OR coalesce(p_data->>'contract','')='' OR NOT coalesce((p_data->>'docs_complete')::boolean,false) OR NOT coalesce((p_data->>'signed')::boolean,false) OR NOT coalesce((p_data->>'accepted')::boolean,false)) THEN
    RAISE EXCEPTION 'Para registrar a venda, preencha todos os dados da carta e confirme documentação, assinatura e aceite. Ou salve como rascunho'; END IF;
  IF coalesce(p_data->>'grp','')<>'' AND coalesce(p_data->>'quota','')<>'' AND EXISTS (SELECT 1 FROM op_cases WHERE organization_id=p_org AND grp=trim(p_data->>'grp') AND quota=trim(p_data->>'quota') AND admin IS NOT DISTINCT FROM nullif(trim(p_data->>'admin'),'')) THEN
    RAISE EXCEPTION 'Este grupo e cota já possuem operação na administradora. Confira antes de registrar'; END IF;
  cid := _client_for(p_org,trim(p_data->>'client_name'),p_data->>'cpf_cnpj',p_data->>'phone',p_data->>'email',seller,NULL);
  INSERT INTO op_cases (organization_id,customer_id,seller_user_id,client_name,cpf_cnpj,phone,email,product,admin,grp,quota,credit,term,contract,sale_date,status,docs,first_payment,signed,accepted,manual,created_by,history)
  VALUES (p_org,cid,seller,trim(p_data->>'client_name'),_doc_norm(p_data->>'cpf_cnpj'),_norm_phone(p_data->>'phone'),nullif(trim(p_data->>'email'),''),nullif(p_data->>'product',''),nullif(trim(p_data->>'admin'),''),nullif(trim(p_data->>'grp'),''),nullif(trim(p_data->>'quota'),''),
    nullif(p_data->>'credit','')::numeric,nullif(p_data->>'term','')::int,coalesce(nullif(trim(p_data->>'contract'),''),'A definir'),nullif(p_data->>'sale_date','')::date,
    CASE WHEN complete THEN 'Efetivado' ELSE 'Documentação pendente' END,
    CASE WHEN coalesce((p_data->>'docs_complete')::boolean,false) THEN 'Completo' ELSE 'Pendente' END,
    CASE WHEN coalesce((p_data->>'first_payment')::boolean,false) THEN 'Pago' ELSE 'Pendente' END,
    coalesce((p_data->>'signed')::boolean,false),coalesce((p_data->>'accepted')::boolean,false),true,me,
    jsonb_build_array(jsonb_build_object('at',now(),'by',me,'what',CASE WHEN complete THEN 'Venda registrada manualmente' ELSE 'Rascunho manual salvo' END))) RETURNING * INTO c;
  RETURN to_jsonb(c);
END $$;

-- Clientes
CREATE OR REPLACE FUNCTION crm_customers_list(p_org text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE me text := _require(p_org,'contatos',1); office boolean := perm_level(p_org,'suporte')>=3;
BEGIN
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.name) FROM (
    SELECT cl.id, cl.name, cl.cpf_cnpj, cl.phone, cl.email, cl.owner_user_id, coalesce(cl.metadata->>'notes','') AS notes,
      coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.created_at DESC) FROM op_cases c WHERE c.customer_id=cl.id AND c.organization_id=p_org AND c.returned_at IS NULL AND (office OR c.seller_user_id=me OR can_see_owner(p_org,c.seller_user_id))),'[]'::jsonb) AS cases
    FROM clients cl WHERE cl.organization_id=p_org AND (office OR cl.owner_user_id=me OR can_see_owner(p_org,cl.owner_user_id)
       OR EXISTS (SELECT 1 FROM op_cases c WHERE c.customer_id=cl.id AND (c.seller_user_id=me OR can_see_owner(p_org,c.seller_user_id))))
  ) x),'[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION crm_customer_save(p_org text, p_id text, p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE me text := _require(p_org,'contatos',2); cl clients; office boolean := perm_level(p_org,'suporte')>=3; d text := _doc_norm(p_data->>'cpf_cnpj');
BEGIN
  SELECT * INTO cl FROM clients WHERE id=p_id AND organization_id=p_org FOR UPDATE;
  IF NOT FOUND OR NOT (office OR cl.owner_user_id=me OR can_see_owner(p_org,cl.owner_user_id)) THEN RAISE EXCEPTION 'Cliente fora da sua carteira' USING ERRCODE='42501'; END IF;
  IF d IS NOT NULL AND length(d) NOT IN (11,14) THEN RAISE EXCEPTION 'Informe CPF ou CNPJ completo'; END IF;
  IF d IS NOT NULL AND EXISTS (SELECT 1 FROM clients WHERE organization_id=p_org AND id<>p_id AND _doc_norm(cpf_cnpj)=d) THEN RAISE EXCEPTION 'Já existe cliente com este CPF/CNPJ'; END IF;
  UPDATE clients SET name=coalesce(nullif(trim(p_data->>'name'),''),name), cpf_cnpj=CASE WHEN p_data ? 'cpf_cnpj' THEN d ELSE cpf_cnpj END,
    phone=CASE WHEN p_data ? 'phone' THEN nullif(trim(p_data->>'phone'),'') ELSE phone END, email=CASE WHEN p_data ? 'email' THEN nullif(trim(p_data->>'email'),'') ELSE email END,
    owner_user_id=CASE WHEN office AND p_data ? 'owner_user_id' THEN p_data->>'owner_user_id' ELSE owner_user_id END,
    metadata=CASE WHEN p_data ? 'notes' THEN coalesce(metadata,'{}'::jsonb)||jsonb_build_object('notes',p_data->>'notes') ELSE metadata END, updated_at=now()
  WHERE id=p_id RETURNING * INTO cl;
  UPDATE op_cases SET client_name=cl.name, cpf_cnpj=cl.cpf_cnpj, phone=coalesce(cl.phone,phone), email=coalesce(cl.email,email), updated_at=now() WHERE customer_id=p_id AND organization_id=p_org;
  RETURN to_jsonb(cl);
END $$;

-- Nova venda para cliente existente: abre oportunidade no Kanban
CREATE OR REPLACE FUNCTION crm_customer_new_sale(p_org text, p_id text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE me text := _require(p_org,'contatos',2); cl clients; l leads; owner_id text;
BEGIN
  SELECT * INTO cl FROM clients WHERE id=p_id AND organization_id=p_org;
  IF NOT FOUND OR NOT (perm_level(p_org,'suporte')>=3 OR cl.owner_user_id=me OR can_see_owner(p_org,cl.owner_user_id)) THEN RAISE EXCEPTION 'Cliente fora da sua carteira' USING ERRCODE='42501'; END IF;
  owner_id := coalesce(cl.owner_user_id, me);
  SELECT * INTO l FROM leads WHERE organization_id=p_org AND status IS DISTINCT FROM 'excluido' AND fechou=false AND _doc_norm(cpf_cnpj) IS NOT DISTINCT FROM _doc_norm(cl.cpf_cnpj) AND _doc_norm(cl.cpf_cnpj) IS NOT NULL LIMIT 1;
  IF FOUND THEN RAISE EXCEPTION 'Este cliente já tem uma oportunidade aberta no Kanban'; END IF;
  INSERT INTO leads (organization_id,owner_user_id,name,phone,email,cpf_cnpj,origin,stage,last_contact)
  VALUES (p_org,owner_id,cl.name,cl.phone,cl.email,cl.cpf_cnpj,'Indicação','Novo Lead',to_char(now() AT TIME ZONE 'America/Cuiaba','DD/MM/YYYY HH24:MI')) RETURNING * INTO l;
  RETURN to_jsonb(l);
END $$;

DO $$ DECLARE f text; BEGIN
  FOR f IN SELECT p.oid::regprocedure::text FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND (p.proname LIKE 'crm\_case%' OR p.proname LIKE 'crm\_customer%' OR p.proname IN ('crm_lead_close_sale','_is_office','_doc_norm','_case_visible','_client_for')) LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', f); END IF;
    IF f ~ '^(public\.)?crm_' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f); ELSE EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', f); END IF;
  END LOOP; END $$;
