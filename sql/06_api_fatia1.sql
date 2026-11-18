-- =====================================================================
-- ALVO CRM — API EM FUNÇÕES DO BANCO, FATIA 1
-- Roda depois de 02, 04 e 05. Contatos, funis/negócios, tarefas, convites e XP.
--
-- Por que funções: o front é estático (Cloudflare Pages) e não tem servidor.
-- Toda gravação passa por aqui. Cada função:
--   * roda como dono (SECURITY DEFINER) com search_path fixo;
--   * descobre quem chama por auth.uid() (nunca recebe o usuário por parâmetro);
--   * checa o nível do módulo (0 a 3) e o escopo de dados (próprio, equipe, organização);
--   * só é executável por usuários logados (authenticated).
-- Erros usam SQLSTATE 42501 (sem permissão) e P0001 (regra de negócio).
-- =====================================================================

-- ---------- utilitários internos ----------
CREATE FUNCTION _require(p_org text, p_module text, p_min int) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE me text := my_user_id();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Usuário não vinculado ao CRM' USING ERRCODE = '42501'; END IF;
  IF perm_level(p_org, p_module) < p_min THEN
    RAISE EXCEPTION 'Sem permissão no módulo %', p_module USING ERRCODE = '42501';
  END IF;
  RETURN me;
END $$;

CREATE FUNCTION _org_today(p_org text) RETURNS date
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT (now() AT TIME ZONE coalesce((SELECT timezone FROM organizations WHERE id = p_org), 'America/Cuiaba'))::date
$$;

-- XP idempotente, com limite diário por ação. Devolve o XP concedido (0 se repetido ou acima do limite).
CREATE FUNCTION _award_xp(p_org text, p_user text, p_action text, p_ref_type text, p_ref_id text, p_xp int DEFAULT NULL) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r xp_rules; want int; used int; give int; day date := _org_today(p_org); n int;
BEGIN
  SELECT * INTO r FROM xp_rules WHERE action_key = p_action;
  IF NOT FOUND THEN RETURN 0; END IF;
  want := coalesce(p_xp, r.xp);
  IF r.daily_cap > 0 THEN
    SELECT coalesce(sum(xp), 0) INTO used FROM xp_events
     WHERE organization_id = p_org AND user_id = p_user AND action_key = p_action AND occurred_on = day;
    give := least(want, greatest(r.daily_cap - used, 0));
  ELSE
    give := want;
  END IF;
  IF give <= 0 THEN RETURN 0; END IF;
  INSERT INTO xp_events (organization_id, user_id, action_key, xp, ref_type, ref_id, occurred_on)
  VALUES (p_org, p_user, p_action, give, p_ref_type, p_ref_id, day)
  ON CONFLICT (organization_id, user_id, action_key, ref_type, ref_id) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN CASE WHEN n = 1 THEN give ELSE 0 END;
END $$;

CREATE FUNCTION _role_to_user_role(p_role text) RETURNS user_role
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE p_role WHEN 'PROPRIETARIO' THEN 'ADMIN' WHEN 'ADMINISTRADOR' THEN 'ADMIN' WHEN 'GESTOR' THEN 'GESTOR_COMERCIAL'
                     WHEN 'SUPORTE' THEN 'SUPORTE' WHEN 'FINANCEIRO' THEN 'FINANCEIRO' ELSE 'VENDEDOR' END::user_role
$$;

-- ---------- sessão: tudo que o front precisa ao abrir ----------
CREATE FUNCTION crm_me(p_org text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me text := my_user_id(); org text; res jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sem sessão' USING ERRCODE = '42501'; END IF;
  IF me IS NULL THEN RETURN jsonb_build_object('linked', false); END IF;
  SELECT coalesce(p_org, (SELECT m.organization_id FROM memberships m WHERE m.user_id = me AND m.status = 'ATIVO' ORDER BY m.created_at LIMIT 1)) INTO org;
  SELECT jsonb_build_object(
    'linked', true,
    'user', (SELECT jsonb_build_object('id', u.id, 'name', u.display_name, 'email', u.corporate_email) FROM users u WHERE u.id = me),
    'organizations', coalesce((SELECT jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'plan', o.plan_key, 'role', m.role_key) ORDER BY o.name)
                               FROM memberships m JOIN organizations o ON o.id = m.organization_id WHERE m.user_id = me AND m.status = 'ATIVO'), '[]'),
    'active_org', org,
    'role', (SELECT m.role_key FROM memberships m WHERE m.user_id = me AND m.organization_id = org AND m.status = 'ATIVO'),
    'data_scope', (SELECT r.data_scope FROM memberships m JOIN org_roles r ON r.organization_id = m.organization_id AND r.role_key = m.role_key
                   WHERE m.user_id = me AND m.organization_id = org AND m.status = 'ATIVO'),
    'permissions', coalesce((SELECT jsonb_object_agg(rp.module, rp.level) FROM memberships m JOIN role_permissions rp
                   ON rp.organization_id = m.organization_id AND rp.role_key = m.role_key
                   WHERE m.user_id = me AND m.organization_id = org AND m.status = 'ATIVO'), '{}')
  ) INTO res;
  UPDATE memberships SET last_access_at = now() WHERE user_id = me AND organization_id = org AND status = 'ATIVO';
  RETURN res;
END $$;

-- ---------- convites ----------
CREATE FUNCTION crm_create_invitation(p_org text, p_email text, p_role_key text, p_team_id text DEFAULT NULL) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me text := _require(p_org, 'equipe', 2); tok text; used int; cap int; em text := lower(trim(p_email));
BEGIN
  IF em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'E-mail inválido'; END IF;
  IF p_role_key = 'PROPRIETARIO' THEN RAISE EXCEPTION 'O perfil Proprietário não pode ser convidado'; END IF;
  IF NOT EXISTS (SELECT 1 FROM org_roles WHERE organization_id = p_org AND role_key = p_role_key) THEN RAISE EXCEPTION 'Perfil inexistente'; END IF;
  SELECT count(*) INTO used FROM memberships WHERE organization_id = p_org AND status = 'ATIVO';
  used := used + (SELECT count(*) FROM invitations WHERE organization_id = p_org AND status = 'PENDENTE' AND expires_at > now());
  SELECT seats INTO cap FROM organizations WHERE id = p_org;
  IF used >= cap THEN RAISE EXCEPTION 'Sem assentos livres no plano (% de %)', used, cap; END IF;
  UPDATE invitations SET status = 'EXPIRADO' WHERE organization_id = p_org AND lower(email) = em AND status = 'PENDENTE' AND expires_at <= now();
  tok := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  INSERT INTO invitations (organization_id, email, role_key, team_id, token_hash, invited_by)
  VALUES (p_org, em, p_role_key, p_team_id, encode(sha256(convert_to(tok, 'UTF8')), 'hex'), me);
  RETURN tok;   -- o token só existe aqui; no banco fica o hash
END $$;

CREATE FUNCTION crm_accept_invitation(p_token text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv invitations; jwt_email text := lower(coalesce(auth.jwt() ->> 'email', '')); uid text; used int; cap int; nm text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sem sessão' USING ERRCODE = '42501'; END IF;
  SELECT * INTO inv FROM invitations
   WHERE token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex') AND status = 'PENDENTE' AND expires_at > now() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Convite inválido ou expirado'; END IF;
  IF lower(inv.email) <> jwt_email THEN RAISE EXCEPTION 'Este convite é para outro e-mail' USING ERRCODE = '42501'; END IF;
  SELECT count(*) INTO used FROM memberships WHERE organization_id = inv.organization_id AND status = 'ATIVO';
  SELECT seats INTO cap FROM organizations WHERE id = inv.organization_id;
  IF used >= cap THEN RAISE EXCEPTION 'Sem assentos livres no plano'; END IF;
  nm := coalesce(nullif(auth.jwt() -> 'user_metadata' ->> 'name', ''), split_part(jwt_email, '@', 1));
  SELECT id INTO uid FROM users WHERE auth_user_id = auth.uid();
  IF uid IS NULL THEN
    INSERT INTO users (display_name, corporate_email, role, auth_user_id)
    VALUES (nm, jwt_email, _role_to_user_role(inv.role_key), auth.uid())
    ON CONFLICT (corporate_email) DO UPDATE SET auth_user_id = EXCLUDED.auth_user_id
    RETURNING id INTO uid;
  END IF;
  INSERT INTO memberships (organization_id, user_id, role_key, team_id)
  VALUES (inv.organization_id, uid, inv.role_key, inv.team_id)
  ON CONFLICT (organization_id, user_id) DO UPDATE SET role_key = EXCLUDED.role_key, team_id = EXCLUDED.team_id, status = 'ATIVO';
  UPDATE invitations SET status = 'ACEITO', accepted_at = now() WHERE id = inv.id;
  RETURN jsonb_build_object('organization_id', inv.organization_id, 'role', inv.role_key);
END $$;

-- ---------- contatos (leads) ----------
CREATE FUNCTION crm_upsert_contact(p_org text, p_id text DEFAULT NULL, p_name text DEFAULT NULL, p_phone text DEFAULT NULL, p_email text DEFAULT NULL,
  p_cpf_cnpj text DEFAULT NULL, p_origin text DEFAULT NULL, p_product_interest text DEFAULT NULL, p_desired_credit numeric DEFAULT NULL,
  p_tags text[] DEFAULT NULL, p_owner text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me text := _require(p_org, 'contatos', 2); owner_id text; ph text := nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), ''); dup text; row_ leads;
BEGIN
  IF p_id IS NULL AND coalesce(trim(p_name), '') = '' THEN RAISE EXCEPTION 'Nome é obrigatório'; END IF;
  IF p_desired_credit IS NOT NULL AND p_desired_credit < 0 THEN RAISE EXCEPTION 'Crédito não pode ser negativo'; END IF;
  IF ph IS NOT NULL THEN
    SELECT id INTO dup FROM leads WHERE organization_id = p_org AND regexp_replace(coalesce(phone, ''), '\D', '', 'g') = ph AND id IS DISTINCT FROM p_id LIMIT 1;
    IF dup IS NOT NULL THEN RAISE EXCEPTION 'Já existe contato com este telefone (%)', dup; END IF;
  END IF;
  IF p_id IS NULL THEN
    owner_id := coalesce(p_owner, me);
    IF owner_id <> me AND NOT can_see_owner(p_org, owner_id) THEN RAISE EXCEPTION 'Sem permissão para atribuir a este usuário' USING ERRCODE = '42501'; END IF;
    INSERT INTO leads (organization_id, owner_user_id, name, phone, email, cpf_cnpj, origin, product_interest, desired_credit, tags, stage)
    VALUES (p_org, owner_id, trim(p_name), ph, nullif(trim(p_email), ''), nullif(trim(p_cpf_cnpj), ''), p_origin, p_product_interest, p_desired_credit, coalesce(p_tags, '{}'), 'novo')
    RETURNING * INTO row_;
  ELSE
    SELECT * INTO row_ FROM leads WHERE id = p_id AND organization_id = p_org FOR UPDATE;
    IF NOT FOUND OR NOT can_see_owner(p_org, row_.owner_user_id) THEN RAISE EXCEPTION 'Contato não encontrado' USING ERRCODE = '42501'; END IF;
    IF p_owner IS NOT NULL AND p_owner IS DISTINCT FROM row_.owner_user_id THEN
      IF NOT can_see_owner(p_org, p_owner) THEN RAISE EXCEPTION 'Sem permissão para atribuir a este usuário' USING ERRCODE = '42501'; END IF;
    END IF;
    UPDATE leads SET name = coalesce(nullif(trim(p_name), ''), name), phone = coalesce(ph, phone), email = coalesce(nullif(trim(p_email), ''), email),
      cpf_cnpj = coalesce(nullif(trim(p_cpf_cnpj), ''), cpf_cnpj), origin = coalesce(p_origin, origin), product_interest = coalesce(p_product_interest, product_interest),
      desired_credit = coalesce(p_desired_credit, desired_credit), tags = coalesce(p_tags, tags), owner_user_id = coalesce(p_owner, owner_user_id), updated_at = now()
    WHERE id = p_id RETURNING * INTO row_;
  END IF;
  RETURN to_jsonb(row_);
END $$;

-- ---------- negócios (funis) ----------
CREATE FUNCTION crm_create_deal(p_org text, p_lead text, p_pipeline_key text DEFAULT 'comercial', p_credit numeric DEFAULT 0,
  p_temperature text DEFAULT 'MORNO', p_product_id text DEFAULT NULL, p_administrator_id text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me text := _require(p_org, 'funis', 2); l leads; pl pipelines; st pipeline_stages; d deals;
BEGIN
  SELECT * INTO l FROM leads WHERE id = p_lead AND organization_id = p_org;
  IF NOT FOUND OR NOT can_see_owner(p_org, l.owner_user_id) THEN RAISE EXCEPTION 'Contato não encontrado' USING ERRCODE = '42501'; END IF;
  SELECT * INTO pl FROM pipelines WHERE organization_id = p_org AND key = p_pipeline_key;
  IF NOT FOUND THEN RAISE EXCEPTION 'Funil inexistente'; END IF;
  SELECT * INTO st FROM pipeline_stages WHERE pipeline_id = pl.id ORDER BY sort LIMIT 1;
  INSERT INTO deals (organization_id, pipeline_id, stage_id, lead_id, owner_user_id, credit_value, temperature, product_id, administrator_id)
  VALUES (p_org, pl.id, st.id, p_lead, coalesce(l.owner_user_id, me), greatest(coalesce(p_credit, 0), 0), p_temperature, p_product_id, p_administrator_id)
  RETURNING * INTO d;
  INSERT INTO deal_stage_history (deal_id, from_stage_id, to_stage_id, changed_by) VALUES (d.id, NULL, st.id, me);
  RETURN to_jsonb(d);
END $$;

CREATE FUNCTION crm_move_deal(p_deal text, p_stage text, p_lost_reason text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d deals; me text; fr pipeline_stages; tos pipeline_stages; xp int := 0; credit_bonus int;
BEGIN
  SELECT * INTO d FROM deals WHERE id = p_deal FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Negócio não encontrado' USING ERRCODE = '42501'; END IF;
  me := _require(d.organization_id, 'funis', 2);
  IF NOT can_see_owner(d.organization_id, d.owner_user_id) THEN RAISE EXCEPTION 'Negócio não encontrado' USING ERRCODE = '42501'; END IF;
  SELECT * INTO fr FROM pipeline_stages WHERE id = d.stage_id;
  SELECT * INTO tos FROM pipeline_stages WHERE id = p_stage AND pipeline_id = d.pipeline_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Etapa inválida para este funil'; END IF;
  IF tos.id = fr.id THEN RETURN jsonb_build_object('deal', to_jsonb(d), 'xp', 0); END IF;
  IF tos.kind = 'PERDIDA' AND coalesce(trim(p_lost_reason), '') = '' THEN RAISE EXCEPTION 'Informe o motivo da perda'; END IF;
  UPDATE deals SET stage_id = tos.id, stage_entered_at = now(), updated_at = now(),
         won_at = CASE WHEN tos.kind = 'GANHA' THEN now() ELSE NULL END,
         lost_reason = CASE WHEN tos.kind = 'PERDIDA' THEN trim(p_lost_reason) ELSE NULL END
   WHERE id = d.id RETURNING * INTO d;
  INSERT INTO deal_stage_history (deal_id, from_stage_id, to_stage_id, changed_by) VALUES (d.id, fr.id, tos.id, me);
  -- XP vai para quem é dono do negócio (quem fecha pontua; o gestor que arrasta não)
  IF d.owner_user_id IS NOT NULL THEN
    IF tos.kind = 'ABERTA' AND tos.sort > fr.sort THEN
      xp := _award_xp(d.organization_id, d.owner_user_id, 'avanco', 'deal_stage', d.id || ':' || tos.id);
    ELSIF tos.kind = 'GANHA' AND (SELECT key FROM pipelines WHERE id = d.pipeline_id) = 'comercial' THEN
      credit_bonus := least(250, floor(d.credit_value / 1000))::int;
      xp := _award_xp(d.organization_id, d.owner_user_id, 'venda', 'deal_won', d.id, 150 + credit_bonus);
    END IF;
  END IF;
  RETURN jsonb_build_object('deal', to_jsonb(d), 'xp', xp);
END $$;

-- ---------- tarefas ----------
CREATE FUNCTION crm_create_task(p_org text, p_title text, p_due_at timestamptz DEFAULT NULL, p_task_type text DEFAULT NULL, p_deal text DEFAULT NULL,
  p_lead text DEFAULT NULL, p_assignee text DEFAULT NULL, p_priority text DEFAULT 'MEDIA') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me text := _require(p_org, 'tarefas', 2); who text := coalesce(p_assignee, me); t tasks;
BEGIN
  IF coalesce(trim(p_title), '') = '' THEN RAISE EXCEPTION 'Título é obrigatório'; END IF;
  IF who <> me AND NOT can_see_owner(p_org, who) THEN RAISE EXCEPTION 'Sem permissão para atribuir a este usuário' USING ERRCODE = '42501'; END IF;
  IF p_deal IS NOT NULL AND NOT EXISTS (SELECT 1 FROM deals WHERE id = p_deal AND organization_id = p_org) THEN RAISE EXCEPTION 'Negócio inexistente'; END IF;
  IF p_lead IS NOT NULL AND NOT EXISTS (SELECT 1 FROM leads WHERE id = p_lead AND organization_id = p_org) THEN RAISE EXCEPTION 'Contato inexistente'; END IF;
  INSERT INTO tasks (organization_id, title, due_at, task_type, deal_id, lead_id, assigned_user_id, priority)
  VALUES (p_org, trim(p_title), p_due_at, p_task_type, p_deal, p_lead, who, p_priority) RETURNING * INTO t;
  RETURN to_jsonb(t);
END $$;

CREATE FUNCTION crm_complete_task(p_task text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t tasks; me text; xp int := 0;
BEGIN
  SELECT * INTO t FROM tasks WHERE id = p_task FOR UPDATE;
  IF NOT FOUND OR t.organization_id IS NULL THEN RAISE EXCEPTION 'Tarefa não encontrada' USING ERRCODE = '42501'; END IF;
  me := _require(t.organization_id, 'tarefas', 2);
  IF NOT can_see_owner(t.organization_id, t.assigned_user_id) THEN RAISE EXCEPTION 'Tarefa não encontrada' USING ERRCODE = '42501'; END IF;
  IF t.status = 'CONCLUIDA' THEN RETURN jsonb_build_object('task', to_jsonb(t), 'xp', 0); END IF;
  UPDATE tasks SET status = 'CONCLUIDA', completed_at = now(), updated_at = now() WHERE id = t.id RETURNING * INTO t;
  IF t.assigned_user_id IS NOT NULL AND (t.due_at IS NULL OR t.completed_at <= t.due_at) THEN
    xp := _award_xp(t.organization_id, t.assigned_user_id, CASE WHEN t.task_type = 'LIGACAO' THEN 'call' ELSE 'tarefa' END, 'task', t.id);
  END IF;
  RETURN jsonb_build_object('task', to_jsonb(t), 'xp', xp);
END $$;

-- ---------- permissões de execução: só usuários logados ----------
DO $$
DECLARE f text;
BEGIN
  FOR f IN SELECT p.oid::regprocedure::text FROM pg_proc p
           WHERE p.pronamespace = 'public'::regnamespace AND (p.proname LIKE 'crm\_%' OR p.proname LIKE '\_%')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', f); END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      -- funções com prefixo _ são internas (chamadas por outras funções SECURITY DEFINER); só as crm_ ficam abertas ao navegador
      IF f LIKE 'crm\_%' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
      ELSE EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', f); END IF;
    END IF;
  END LOOP;
END $$;

INSERT INTO alvo_schema_versions (version, description) VALUES (4, 'API em funções, fatia 1: sessão, convites, contatos, negócios, tarefas, XP');
