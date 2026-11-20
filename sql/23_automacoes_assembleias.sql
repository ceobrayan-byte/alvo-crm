-- 23: Automações de e-mail, alerta de parcela em atraso e resultado de assembleia
-- * Todo dia às 08:10 (Cuiabá) o pg_cron chama a função alvo-mail (ação "cron"), autenticada por um segredo do cofre:
--     dia 02 e 07 → Lembrete de pagamento para TODOS os clientes ativos (vencimento dia 10)
--     dia 10      → Último dia de pagamento
--     todo dia    → Feliz aniversário (clientes com data de nascimento cadastrada)
--     todo dia    → notificação ao proprietário das parcelas em atraso (venceu dia 10 da competência e não foi confirmada)
-- * Cliente ativo = tem cota efetivada (com regra e data de venda), não devolvida e não cancelada no pós-venda.
-- * Nunca repete: o mesmo modelo para o mesmo cliente no mesmo vencimento/dia não é enviado de novo (mail_log).
-- * Assembleia: o suporte registra o resultado (administradora, grupo, data, sorteio, lances, resumo, evidência)
--   e o CRM envia na hora o e-mail "resultado da assembleia" para todos os clientes ativos daquele grupo.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS dedupe_key text;
CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe ON notifications (dedupe_key) WHERE dedupe_key IS NOT NULL;

-- segredo do agendamento (só a chave de serviço lê)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name='cron_secret') THEN
    PERFORM vault.create_secret(replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''),'cron_secret','alvo-mail: chamadas do agendamento');
  END IF; END $$;
CREATE OR REPLACE FUNCTION mail_cron_secret() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='cron_secret' $$;
REVOKE ALL ON FUNCTION mail_cron_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION mail_cron_secret() TO service_role;

-- clientes ativos (uma linha por e-mail, com todas as cotas)
CREATE OR REPLACE FUNCTION mail_active_clients(p_org text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT coalesce(jsonb_agg(x),'[]'::jsonb) FROM (
    SELECT lower(trim(c.email)) AS email, min(c.client_name) AS name, min(c.customer_id) AS client_id,
      bool_or(coalesce((cl.metadata->>'opt_out')::boolean,false)) AS opt_out, max(cl.metadata->>'birth_date') AS birth_date,
      jsonb_agg(jsonb_build_object('case_id',c.id,'adm',c.admin,'grp',c.grp,'quota',c.quota) ORDER BY c.sale_date) AS cotas
    FROM op_cases c LEFT JOIN clients cl ON cl.id=c.customer_id
    WHERE c.organization_id=p_org AND c.status='Efetivado' AND c.rule_id IS NOT NULL AND c.sale_date IS NOT NULL AND c.returned_at IS NULL
      AND coalesce(c.postsale->>'stage','')<>'cancelada' AND c.email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    GROUP BY lower(trim(c.email))) x $$;

-- parcelas em atraso: competência = mês da venda + (n-1); vence dia 10; sem confirmação em Mensalidades
CREATE OR REPLACE FUNCTION fin_overdue(p_org text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  WITH c AS (SELECT id,client_name,seller_user_id,sale_date,first_payment FROM op_cases WHERE organization_id=p_org AND status='Efetivado' AND rule_id IS NOT NULL
               AND sale_date IS NOT NULL AND returned_at IS NULL AND coalesce(postsale->>'stage','')<>'cancelada'),
  p AS (SELECT c.*, n, ((date_trunc('month',c.sale_date)+make_interval(months=>n-1))::date+9) AS due FROM c, generate_series(1,240) n
        WHERE ((date_trunc('month',c.sale_date)+make_interval(months=>n-1))::date+9) < (now() AT TIME ZONE 'America/Cuiaba')::date)
  SELECT coalesce(jsonb_agg(jsonb_build_object('case_id',p.id,'client',p.client_name,'seller',p.seller_user_id,'n',p.n,'due',p.due) ORDER BY p.due, p.client_name),'[]'::jsonb)
  FROM p LEFT JOIN fin_installments i ON i.case_id=p.id AND i.n=p.n
  WHERE coalesce(i.confirmed,false)=false AND NOT (p.n=1 AND p.first_payment='Pago') $$;

REVOKE ALL ON FUNCTION mail_active_clients(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION fin_overdue(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION mail_active_clients(text) TO service_role;
GRANT EXECUTE ON FUNCTION fin_overdue(text) TO service_role;

-- notificações do usuário logado
CREATE OR REPLACE FUNCTION crm_notifications(p_org text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE me text := _require(p_org,'visao-geral',0);
BEGIN
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(n) ORDER BY n.created_at DESC) FROM (SELECT id,kind,body,target_view,read_at,created_at FROM notifications
    WHERE organization_id=p_org AND user_id=me ORDER BY created_at DESC LIMIT 60) n),'[]'::jsonb);
END $$;
CREATE OR REPLACE FUNCTION crm_notification_read(p_org text, p_id bigint) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE me text := _require(p_org,'visao-geral',0);
BEGIN
  UPDATE notifications SET read_at=now() WHERE organization_id=p_org AND user_id=me AND read_at IS NULL AND (p_id IS NULL OR id=p_id);
  RETURN true;
END $$;

-- assembleias
CREATE TABLE IF NOT EXISTS assemblies (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  adm text NOT NULL, grp text NOT NULL, held_on date NOT NULL,
  draw_quotas text[] NOT NULL DEFAULT '{}', bids jsonb NOT NULL DEFAULT '[]', min_bid numeric, max_bid numeric,
  summary text, evidence text NOT NULL,
  created_by text, created_at timestamptz NOT NULL DEFAULT now(),
  sent int, matched jsonb NOT NULL DEFAULT '[]'
);
ALTER TABLE assemblies ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION crm_assemblies(p_org text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE me text := _require(p_org,'suporte',1);
BEGIN
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.held_on DESC, a.created_at DESC) FROM assemblies a WHERE a.organization_id=p_org),'[]'::jsonb);
END $$;
CREATE OR REPLACE FUNCTION crm_assembly_save(p_org text, p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE me text := _require(p_org,'suporte',3); a assemblies; who text;
BEGIN
  IF coalesce(trim(p_data->>'adm'),'')='' OR coalesce(trim(p_data->>'grp'),'')='' THEN RAISE EXCEPTION 'Informe administradora e grupo'; END IF;
  IF (p_data->>'held_on') IS NULL THEN RAISE EXCEPTION 'Informe a data da assembleia'; END IF;
  IF length(coalesce(trim(p_data->>'evidence'),''))<8 THEN RAISE EXCEPTION 'Informe a fonte oficial do resultado (mín. 8 caracteres)'; END IF;
  SELECT display_name INTO who FROM users WHERE id=me;
  INSERT INTO assemblies (organization_id,adm,grp,held_on,draw_quotas,bids,min_bid,max_bid,summary,evidence,created_by)
  VALUES (p_org,trim(p_data->>'adm'),trim(p_data->>'grp'),(p_data->>'held_on')::date,
    coalesce((SELECT array_agg(trim(x)) FROM jsonb_array_elements_text(coalesce(p_data->'draw_quotas','[]')) x WHERE trim(x)<>''),'{}'),
    coalesce(p_data->'bids','[]'),nullif(p_data->>'min_bid','')::numeric,nullif(p_data->>'max_bid','')::numeric,
    nullif(left(trim(coalesce(p_data->>'summary','')),3000),''),left(trim(p_data->>'evidence'),300),who)
  RETURNING * INTO a;
  RETURN to_jsonb(a);
END $$;

-- data de nascimento no cadastro do cliente (para o e-mail de aniversário)
CREATE OR REPLACE FUNCTION crm_customer_birth(p_org text, p_id text, p_birth date) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE me text := _require(p_org,'contatos',2); office boolean := perm_level(p_org,'suporte')>=3; cl clients;
BEGIN
  SELECT * INTO cl FROM clients WHERE id=p_id AND organization_id=p_org FOR UPDATE;
  IF NOT FOUND OR NOT (office OR cl.owner_user_id=me OR can_see_owner(p_org,cl.owner_user_id)) THEN RAISE EXCEPTION 'Cliente fora da sua carteira' USING ERRCODE='42501'; END IF;
  IF p_birth IS NOT NULL AND (p_birth>current_date OR p_birth<'1900-01-01') THEN RAISE EXCEPTION 'Data de nascimento inválida'; END IF;
  UPDATE clients SET metadata=CASE WHEN p_birth IS NULL THEN coalesce(metadata,'{}')-'birth_date' ELSE coalesce(metadata,'{}')||jsonb_build_object('birth_date',p_birth) END, updated_at=now() WHERE id=p_id RETURNING * INTO cl;
  RETURN to_jsonb(cl);
END $$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY array['crm_notifications(text)','crm_notification_read(text,bigint)','crm_assemblies(text)','crm_assembly_save(text,jsonb)','crm_customer_birth(text,text,date)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP; END $$;

-- agendamento diário: 12:10 UTC = 08:10 em Cuiabá
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname='alvo-mail-diario';
SELECT cron.schedule('alvo-mail-diario','10 12 * * *',$$
  SELECT net.http_post(url:='https://mbhouzjmiglhnukpuyco.supabase.co/functions/v1/alvo-mail',
    headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='cron_secret')),
    body:='{"action":"cron"}'::jsonb, timeout_milliseconds:=60000) $$);

-- crm_customers_list passou a devolver birth_date (metadata->>'birth_date'); edição pela tela Clientes → Editar cadastro.
-- Teste em 20/11/2026: 17 clientes ativos, 14 parcelas em atraso → 14 notificações criadas para o proprietário.
