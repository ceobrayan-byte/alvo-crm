-- 29 · Trava do simulador (alvo-simulador): só entra quem a ALVO libera no CRM.
-- O simulador usa este mesmo banco (seller_users / seller_sessions / simulations).
-- Regra: um login do simulador só fica ativo se estiver ligado a uma pessoa ATIVA da equipe no CRM
-- com "Simulador liberado" (memberships.simulator). O proprietário sempre tem acesso.
-- * cadastro novo de quem não está liberado é recusado (a tela /cadastro deixa de abrir conta para estranhos);
-- * sessões de quem perde o acesso são encerradas na hora;
-- * reativar pelo painel do próprio simulador não funciona: o banco devolve para inativo.
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS simulator boolean NOT NULL DEFAULT false;
ALTER TABLE seller_users ADD COLUMN IF NOT EXISTS crm_user_id text REFERENCES users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION _sim_crm_user(p_email text, p_linked text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT coalesce(p_linked, (SELECT u.id FROM users u JOIN memberships m ON m.user_id=u.id AND m.organization_id='ORG-000001'
    WHERE lower(trim(u.corporate_email))=lower(trim(p_email)) ORDER BY (m.status='ATIVO') DESC LIMIT 1)) $$;

CREATE OR REPLACE FUNCTION _sim_allowed(p_crm_user text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT p_crm_user IS NOT NULL AND EXISTS (SELECT 1 FROM memberships m WHERE m.user_id=p_crm_user AND m.organization_id='ORG-000001'
    AND m.status='ATIVO' AND (m.simulator OR m.role_key='PROPRIETARIO')) $$;

-- cadastro/alteração de login do simulador
CREATE OR REPLACE FUNCTION _sim_guard_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  NEW.crm_user_id := _sim_crm_user(NEW.email, NEW.crm_user_id);
  IF TG_OP='INSERT' AND NOT _sim_allowed(NEW.crm_user_id) THEN
    RAISE EXCEPTION 'Cadastro fechado: o acesso ao simulador é liberado pela ALVO no CRM (Equipe e permissões).' USING ERRCODE='42501';
  END IF;
  NEW.active := coalesce(NEW.active,true) AND _sim_allowed(NEW.crm_user_id);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sim_guard_user ON seller_users;
CREATE TRIGGER sim_guard_user BEFORE INSERT OR UPDATE ON seller_users FOR EACH ROW EXECUTE FUNCTION _sim_guard_user();

-- login: não abre sessão para quem não está liberado
CREATE OR REPLACE FUNCTION _sim_guard_session() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM seller_users s WHERE s.id=NEW.user_id AND s.active AND _sim_allowed(s.crm_user_id)) THEN
    RAISE EXCEPTION 'Acesso ao simulador bloqueado. Fale com a ALVO.' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sim_guard_session ON seller_sessions;
CREATE TRIGGER sim_guard_session BEFORE INSERT ON seller_sessions FOR EACH ROW EXECUTE FUNCTION _sim_guard_session();

-- reaplica a regra a todos os logins e encerra sessões de quem perdeu o acesso
CREATE OR REPLACE FUNCTION sim_sync() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n_off int; n_kill int;
BEGIN
  UPDATE seller_users SET updated_at=updated_at;  -- dispara o gatilho (vínculo + ativo)
  SELECT count(*) INTO n_off FROM seller_users WHERE NOT active;
  DELETE FROM seller_sessions z USING seller_users s WHERE s.id=z.user_id AND NOT s.active;
  GET DIAGNOSTICS n_kill = ROW_COUNT;
  RETURN jsonb_build_object('bloqueados',n_off,'sessoes_encerradas',n_kill);
END $$;

CREATE OR REPLACE FUNCTION _sim_member_changed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN PERFORM sim_sync(); RETURN NULL; END $$;
DROP TRIGGER IF EXISTS sim_member_changed ON memberships;
CREATE TRIGGER sim_member_changed AFTER UPDATE OF simulator, status, role_key ON memberships FOR EACH STATEMENT EXECUTE FUNCTION _sim_member_changed();

-- CRM: lista e liberação (Equipe nível 3 = proprietário/administrador)
CREATE OR REPLACE FUNCTION crm_simulator_list(p_org text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE me text := _require(p_org,'equipe',3);
BEGIN
  RETURN jsonb_build_object(
   'members', coalesce((SELECT jsonb_object_agg(m.user_id, jsonb_build_object('on', m.simulator OR m.role_key='PROPRIETARIO', 'owner', m.role_key='PROPRIETARIO',
      'logins', coalesce((SELECT jsonb_agg(jsonb_build_object('email',s.email,'active',s.active,'sims',(SELECT count(*) FROM simulations x WHERE x.owner_id=s.id),
        'last',(SELECT max(created_at) FROM seller_sessions z WHERE z.user_id=s.id)) ORDER BY s.created_at) FROM seller_users s WHERE s.crm_user_id=m.user_id),'[]'::jsonb)))
     FROM memberships m WHERE m.organization_id=p_org),'{}'::jsonb),
   'outsiders', coalesce((SELECT jsonb_agg(jsonb_build_object('email',s.email,'name',s.display_name,'active',s.active) ORDER BY s.created_at) FROM seller_users s WHERE s.crm_user_id IS NULL),'[]'::jsonb));
END $$;
CREATE OR REPLACE FUNCTION crm_simulator_set(p_org text, p_user text, p_on boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE me text := _require(p_org,'equipe',3);
BEGIN
  UPDATE memberships SET simulator=p_on WHERE organization_id=p_org AND user_id=p_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pessoa não encontrada'; END IF;
  RETURN sim_sync();
END $$;
-- liga um login do simulador (e-mail pessoal diferente do e-mail do CRM) a uma pessoa da equipe
CREATE OR REPLACE FUNCTION crm_simulator_link(p_org text, p_user text, p_email text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE me text := _require(p_org,'equipe',3);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM memberships WHERE organization_id=p_org AND user_id=p_user) THEN RAISE EXCEPTION 'Pessoa não encontrada'; END IF;
  UPDATE seller_users SET crm_user_id=p_user WHERE lower(email)=lower(trim(p_email));
  IF NOT FOUND THEN RAISE EXCEPTION 'Nenhum login do simulador com este e-mail'; END IF;
  RETURN sim_sync();
END $$;

REVOKE ALL ON FUNCTION _sim_crm_user(text,text), _sim_allowed(text), sim_sync() FROM PUBLIC, anon, authenticated;
DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY array['crm_simulator_list(text)','crm_simulator_set(text,text,boolean)','crm_simulator_link(text,text,text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP; END $$;

-- estado inicial: toda a equipe ativa liberada; login antigo do proprietário (gmail) ligado a ele;
-- quem não é da equipe (ou está inativo) fica bloqueado.
UPDATE seller_users SET crm_user_id='USR-000001' WHERE lower(email)='brayanschafer.nl@gmail.com';
UPDATE memberships SET simulator=true WHERE organization_id='ORG-000001' AND status='ATIVO';
SELECT sim_sync();
