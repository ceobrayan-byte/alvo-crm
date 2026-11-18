-- =====================================================================
-- ALVO CRM — API EM FUNÇÕES, FATIA 2A
-- Roda depois de 06. Leitura da equipe, meta da organização e pós-venda automático.
--
-- Por que existe: o navegador não lê a tabela `users` (privilégio revogado no hardening),
-- então os nomes dos colegas vêm de crm_team(). A venda efetivada passa a abrir o caso de
-- pós-venda e a tarefa de documentos no banco, de forma atômica e sem duplicar.
-- =====================================================================

-- ---------- equipe da organização (nomes, perfis e equipes) ----------
CREATE FUNCTION crm_team(p_org text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE can_mail boolean;
BEGIN
  IF NOT is_member(p_org) THEN RAISE EXCEPTION 'Sem acesso a esta organização' USING ERRCODE = '42501'; END IF;
  can_mail := perm_level(p_org, 'equipe') >= 1;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', u.id, 'name', u.display_name,
      'email', CASE WHEN can_mail THEN u.corporate_email END,
      'role', m.role_key, 'team_id', m.team_id, 'team', t.name, 'job_title', m.job_title,
      'status', m.status, 'is_seller', m.is_seller,
      'last_access_at', CASE WHEN can_mail THEN m.last_access_at END) ORDER BY u.display_name)
    FROM memberships m JOIN users u ON u.id = m.user_id LEFT JOIN teams t ON t.id = m.team_id
    WHERE m.organization_id = p_org), '[]'::jsonb);
END $$;

-- ---------- meta de crédito do ciclo ----------
CREATE FUNCTION crm_set_org_goal(p_org text, p_goal numeric) RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _require(p_org, 'metas', 3);
  IF p_goal IS NULL OR p_goal <= 0 THEN RAISE EXCEPTION 'Informe uma meta maior que zero'; END IF;
  UPDATE organizations SET goal_credit = p_goal, updated_at = now() WHERE id = p_org;
  RETURN p_goal;
END $$;

-- ---------- mover negócio: agora a venda efetivada abre o pós-venda ----------
CREATE OR REPLACE FUNCTION crm_move_deal(p_deal text, p_stage text, p_lost_reason text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d deals; me text; fr pipeline_stages; tos pipeline_stages; xp int := 0; credit_bonus int; prev_won boolean;
        pp pipelines; ps pipeline_stages; nd deals; first_name text; post_id text;
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
  prev_won := d.won_at IS NOT NULL;
  UPDATE deals SET stage_id = tos.id, stage_entered_at = now(), updated_at = now(),
         won_at = CASE WHEN tos.kind = 'GANHA' THEN now() ELSE NULL END,
         lost_reason = CASE WHEN tos.kind = 'PERDIDA' THEN trim(p_lost_reason) ELSE NULL END
   WHERE id = d.id RETURNING * INTO d;
  INSERT INTO deal_stage_history (deal_id, from_stage_id, to_stage_id, changed_by) VALUES (d.id, fr.id, tos.id, me);
  IF d.owner_user_id IS NOT NULL THEN
    IF tos.kind = 'ABERTA' AND tos.sort > fr.sort THEN
      xp := _award_xp(d.organization_id, d.owner_user_id, 'avanco', 'deal_stage', d.id || ':' || tos.id);
    ELSIF tos.kind = 'GANHA' AND (SELECT key FROM pipelines WHERE id = d.pipeline_id) = 'comercial' THEN
      credit_bonus := least(250, floor(d.credit_value / 1000))::int;
      xp := _award_xp(d.organization_id, d.owner_user_id, 'venda', 'deal_won', d.id, 150 + credit_bonus);
    END IF;
  END IF;
  -- venda efetivada pela primeira vez: abre o caso no pós-venda (uma vez por contato) e a tarefa de documentos
  IF tos.kind = 'GANHA' AND NOT prev_won AND d.lead_id IS NOT NULL AND (SELECT key FROM pipelines WHERE id = d.pipeline_id) = 'comercial' THEN
    SELECT * INTO pp FROM pipelines WHERE organization_id = d.organization_id AND key = 'posvenda';
    IF FOUND AND NOT EXISTS (SELECT 1 FROM deals WHERE lead_id = d.lead_id AND pipeline_id = pp.id) THEN
      SELECT * INTO ps FROM pipeline_stages WHERE pipeline_id = pp.id ORDER BY sort LIMIT 1;
      INSERT INTO deals (organization_id, pipeline_id, stage_id, lead_id, owner_user_id, credit_value, temperature, product_id, administrator_id)
      VALUES (d.organization_id, pp.id, ps.id, d.lead_id, d.owner_user_id, d.credit_value, 'MORNO', d.product_id, d.administrator_id)
      RETURNING * INTO nd;
      post_id := nd.id;
      INSERT INTO deal_stage_history (deal_id, from_stage_id, to_stage_id, changed_by) VALUES (nd.id, NULL, ps.id, me);
      SELECT split_part(name, ' ', 1) INTO first_name FROM leads WHERE id = d.lead_id;
      INSERT INTO tasks (organization_id, title, due_at, task_type, deal_id, lead_id, assigned_user_id, priority)
      VALUES (d.organization_id, 'Coletar documentos · ' || coalesce(first_name, 'cliente'), now() + interval '6 hours', 'DOCUMENTOS', nd.id, d.lead_id, d.owner_user_id, 'ALTA');
    END IF;
  END IF;
  RETURN jsonb_build_object('deal', to_jsonb(d), 'xp', xp, 'postsale_deal', post_id);
END $$;

-- ---------- permissões de execução ----------
DO $$
DECLARE f text;
BEGIN
  FOR f IN SELECT p.oid::regprocedure::text FROM pg_proc p
           WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('crm_team', 'crm_set_org_goal')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', f); END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f); END IF;
  END LOOP;
END $$;

INSERT INTO alvo_schema_versions (version, description) VALUES (5, 'API fatia 2A: equipe, meta da organização, pós-venda automático na venda');
