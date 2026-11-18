-- =====================================================================
-- ALVO CRM — ENDURECIMENTO DE PRIVILÉGIOS (Supabase)
-- Roda DEPOIS de 02_schema_supabase.sql e 04_schema_novo_modulos.sql.
--
-- Por quê: no Supabase, toda tabela nova do schema public nasce com permissão
-- total para os papéis anon (sem login) e authenticated (logado). O RLS é a única
-- barreira. Aqui aplicamos menor privilégio em camadas:
--   1. anon não toca em nada do CRM.
--   2. authenticated só lê o que tem policy de leitura. Gravação passa pelas
--      funções da API (SECURITY DEFINER), exceto 3 casos explícitos.
--   3. whatsapp_instances: a coluna secret_ref nunca é legível pelo navegador.
--   4. Funções auxiliares de RLS não ficam expostas ao anon.
--
-- As 6 tabelas do simulador que já existiam no alvo-crm NÃO são tocadas.
-- =====================================================================

-- Vínculo com o Supabase Auth (só existe no Supabase)
ALTER TABLE users
  ADD CONSTRAINT users_auth_user_fk FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER FUNCTION seed_org_defaults(text) SET search_path = public;

-- 1) Retira tudo de anon e authenticated nas tabelas do CRM
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables
           WHERE schemaname = 'public'
             AND tablename NOT IN ('seller_users','seller_sessions','seller_password_resets','crm_opportunities','simulations','consultant_links')
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;
REVOKE ALL ON public.v_cycle_xp FROM anon, authenticated;

-- Sequências (IDs prefixados e identities) só são usadas pelo servidor e pelas funções
DO $$
DECLARE s text;
BEGIN
  FOR s IN SELECT relname FROM pg_class WHERE relkind = 'S' AND relnamespace = 'public'::regnamespace LOOP
    EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM anon, authenticated', s);
  END LOOP;
END $$;

-- 2) Leitura para usuários logados (o RLS filtra por organização, módulo e escopo)
GRANT SELECT ON
  public.plans, public.gamification_levels, public.xp_rules, public.achievements,
  public.organizations, public.teams, public.org_roles, public.role_permissions, public.memberships,
  public.pipelines, public.pipeline_stages, public.deals, public.deal_stage_history,
  public.leads, public.tasks,
  public.whatsapp_templates, public.conversations, public.messages,
  public.user_achievements, public.challenges, public.challenge_claims, public.xp_events,
  public.gamification_prefs, public.invitations, public.subscriptions, public.invoices,
  public.support_tickets, public.support_ticket_messages, public.notifications, public.v_cycle_xp
TO authenticated;

-- 3) Instâncias de WhatsApp: tudo, menos secret_ref
GRANT SELECT (id, organization_id, name, kind, phone_e164, state, provider_ref, quality, message_tier, config, connected_since, created_at)
  ON public.whatsapp_instances TO authenticated;

-- Gravação direta permitida (as policies correspondentes já existem)
GRANT INSERT, UPDATE ON public.gamification_prefs TO authenticated;   -- modo pausa e ranking
GRANT INSERT ON public.support_tickets TO authenticated;              -- abrir chamado
GRANT UPDATE (read_at) ON public.notifications TO authenticated;     -- marcar como lida

-- 4) Funções auxiliares: só usuários logados (as policies as chamam)
REVOKE ALL ON FUNCTION public.my_user_id(), public.is_member(text), public.perm_level(text, text), public.can_see_owner(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_user_id(), public.is_member(text), public.perm_level(text, text), public.can_see_owner(text, text) TO authenticated;

INSERT INTO alvo_schema_versions (version, description) VALUES (3, 'Endurecimento: menor privilégio para anon/authenticated, secret_ref oculto, FK com auth.users');
