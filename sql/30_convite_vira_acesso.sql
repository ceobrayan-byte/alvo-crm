-- 30 · Convidar usuário = criar a pessoa na equipe + enviar acesso por e-mail (senha provisória).
-- O link de convite antigo dependia de cadastro público no login; agora o convite vira acesso na hora.
-- crm_member_create: cria (ou reativa) a pessoa com perfil e equipe e marca convites pendentes do e-mail como aceitos.
-- crm_invitation_revoke: revoga um convite pendente.
CREATE OR REPLACE FUNCTION crm_member_create(p_org text, p_name text, p_email text, p_role_key text, p_team_id text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE me text := _require(p_org,'equipe',3); em text := lower(trim(coalesce(p_email,''))); nm text := trim(coalesce(p_name,'')); uid text; used int; cap int;
BEGIN
  IF em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'E-mail inválido'; END IF;
  IF length(nm) < 2 THEN RAISE EXCEPTION 'Informe o nome da pessoa'; END IF;
  IF p_role_key = 'PROPRIETARIO' THEN RAISE EXCEPTION 'O perfil Proprietário não pode ser criado aqui'; END IF;
  IF NOT EXISTS (SELECT 1 FROM org_roles WHERE organization_id=p_org AND role_key=p_role_key) THEN RAISE EXCEPTION 'Perfil inexistente'; END IF;
  IF p_team_id IS NOT NULL AND p_team_id <> '' AND NOT EXISTS (SELECT 1 FROM teams WHERE id=p_team_id AND organization_id=p_org) THEN RAISE EXCEPTION 'Equipe inexistente'; END IF;
  SELECT id INTO uid FROM users WHERE lower(corporate_email)=em;
  IF uid IS NOT NULL AND EXISTS (SELECT 1 FROM memberships WHERE organization_id=p_org AND user_id=uid AND status='ATIVO') THEN
    RAISE EXCEPTION 'Este e-mail já está na equipe. Use "Enviar acesso" na ficha da pessoa.';
  END IF;
  SELECT count(*) INTO used FROM memberships WHERE organization_id=p_org AND status='ATIVO';
  SELECT seats INTO cap FROM organizations WHERE id=p_org;
  IF used >= cap THEN RAISE EXCEPTION 'Sem assentos livres no plano (% de %)', used, cap; END IF;
  IF uid IS NULL THEN
    INSERT INTO users (display_name, corporate_email, role) VALUES (nm, em, _role_to_user_role(p_role_key)) RETURNING id INTO uid;
  ELSE
    UPDATE users SET display_name=nm, updated_at=now() WHERE id=uid;
  END IF;
  INSERT INTO memberships (organization_id, user_id, role_key, team_id, status)
  VALUES (p_org, uid, p_role_key, nullif(p_team_id,''), 'ATIVO')
  ON CONFLICT (organization_id, user_id) DO UPDATE SET role_key=EXCLUDED.role_key, team_id=EXCLUDED.team_id, status='ATIVO';
  UPDATE invitations SET status='ACEITO', accepted_at=now() WHERE organization_id=p_org AND lower(email)=em AND status='PENDENTE';
  RETURN uid;
END $$;

CREATE OR REPLACE FUNCTION crm_invitation_revoke(p_org text, p_id text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE me text := _require(p_org,'equipe',3);
BEGIN
  UPDATE invitations SET status='REVOGADO' WHERE organization_id=p_org AND id=p_id AND status='PENDENTE';
  RETURN FOUND;
END $$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY array['crm_member_create(text,text,text,text,text)','crm_invitation_revoke(text,text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP; END $$;
