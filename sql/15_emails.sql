-- 15: Setor de e-mails (cópia do Floot: jornada do cliente + avisos para a equipe, envio pelo Resend)
-- O envio em si é feito pela Edge Function "alvo-mail" (a chave do Resend fica só no servidor).
CREATE TABLE IF NOT EXISTS mail_log (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('cliente','aviso')),
  template text NOT NULL,            -- modelo da jornada (birthday, referral...) ou categoria do aviso
  ref_id text,                       -- caso (op_cases.id) ou usuário (users.id)
  to_name text, to_email text NOT NULL,
  subject text, body text, event_date date,
  status text NOT NULL DEFAULT 'enviando',  -- enviando, enviado, entregue, aberto, devolvido, spam, falhou, incerto
  provider_id text, error text, sent_by text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mail_log_org ON mail_log (organization_id, created_at DESC);
ALTER TABLE mail_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mail_log_read ON mail_log;
CREATE POLICY mail_log_read ON mail_log FOR SELECT TO authenticated USING (perm_level(organization_id,'suporte')>=3);
GRANT SELECT ON mail_log TO authenticated;

-- quem pode usar o setor de e-mails
CREATE OR REPLACE FUNCTION crm_mail_can(p_org text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE me text := _require(p_org,'suporte',3);
BEGIN RETURN jsonb_build_object('user_id',me,'name',(SELECT display_name FROM users WHERE id=me)); END $$;

-- destinatários: clientes com cota efetivada e membros da equipe
CREATE OR REPLACE FUNCTION crm_mail_audience(p_org text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE me text := _require(p_org,'suporte',3);
BEGIN
  RETURN jsonb_build_object(
   'clients', coalesce((SELECT jsonb_agg(jsonb_build_object('case_id',c.id,'client_id',cl.id,'name',coalesce(cl.name,c.client_name),'email',lower(coalesce(nullif(cl.email,''),c.email)),
      'adm',c.admin,'grp',c.grp,'quota',c.quota,'credit',c.credit,'term',c.term,'seller',c.seller_user_id,'status',c.status,
      'marketing_ok',coalesce((cl.metadata->>'marketing_ok')::boolean,false),'opt_out',coalesce((cl.metadata->>'opt_out')::boolean,false),
      'birth_date',cl.metadata->>'birth_date') ORDER BY coalesce(cl.name,c.client_name))
     FROM op_cases c LEFT JOIN clients cl ON cl.id=c.customer_id
     WHERE c.organization_id=p_org AND c.returned_at IS NULL AND c.status='Efetivado'),'[]'::jsonb),
   'team', coalesce((SELECT jsonb_agg(jsonb_build_object('id',u.id,'name',u.display_name,'email',lower(u.corporate_email),'role',m.role_key,'team_id',m.team_id) ORDER BY u.display_name)
     FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.organization_id=p_org AND m.status='ATIVO'),'[]'::jsonb),
   'history', coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC) FROM (SELECT id,kind,template,ref_id,to_name,to_email,subject,event_date,status,error,sent_by,created_at,updated_at FROM mail_log WHERE organization_id=p_org ORDER BY created_at DESC LIMIT 500) x),'[]'::jsonb));
END $$;

-- autorização de campanhas (e-mails promocionais) por cliente
CREATE OR REPLACE FUNCTION crm_mail_marketing(p_org text, p_client text, p_ok boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE me text := _require(p_org,'suporte',3); cl clients;
BEGIN
  UPDATE clients SET metadata=metadata||jsonb_build_object('marketing_ok',p_ok,'marketing_by',me,'marketing_at',now()), updated_at=now()
   WHERE id=p_client AND organization_id=p_org RETURNING * INTO cl;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cliente não encontrado'; END IF;
  RETURN jsonb_build_object('id',cl.id,'marketing_ok',p_ok);
END $$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY array['crm_mail_can(text)','crm_mail_audience(text)','crm_mail_marketing(text,text,boolean)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP; END $$;
