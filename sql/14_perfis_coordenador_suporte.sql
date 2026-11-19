-- 14: Perfis reais da ALVO (18/11/2026)
--  * GESTOR passa a se chamar "Coordenador" (vê os próprios dados e os da equipe).
--  * SUPORTE vê a operação inteira (Funis como o dono, Clientes, Financeiro completo, Negócios, Conversas, WhatsApp, Suporte, E-mails).
--  * role_screens controla só o MENU (quais telas aparecem para cada perfil);
--    role_permissions continua controlando o acesso no banco.
--  * crm_member_update: dono/administrador define perfil e equipe de cada membro (coordenador ganha equipe própria).

UPDATE org_roles SET label='Coordenador' WHERE role_key='GESTOR';
UPDATE org_roles SET data_scope='ORGANIZACAO' WHERE role_key='SUPORTE';

-- permissões de acesso (banco)
WITH v(role_key,module,level) AS (VALUES
 ('SUPORTE','visao-geral',1),('SUPORTE','funis',3),('SUPORTE','contatos',2),('SUPORTE','tarefas',1),('SUPORTE','conversas',3),('SUPORTE','whatsapp',3),('SUPORTE','metas',0),('SUPORTE','equipe',0),('SUPORTE','planos',0),('SUPORTE','suporte',3),
 ('GESTOR','visao-geral',3),('GESTOR','funis',3),('GESTOR','contatos',3),('GESTOR','tarefas',2),('GESTOR','conversas',2),('GESTOR','whatsapp',0),('GESTOR','metas',3),('GESTOR','equipe',1),('GESTOR','planos',0),('GESTOR','suporte',1))
UPDATE role_permissions p SET level=v.level FROM v WHERE p.role_key=v.role_key AND p.module=v.module;

-- menu por perfil (3 = vê e mexe, 2 = vê/edita o que é seu, 1 = só vê, 0 = não aparece)
CREATE TABLE IF NOT EXISTS role_screens (organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, role_key text NOT NULL, screen text NOT NULL, level smallint NOT NULL CHECK (level BETWEEN 0 AND 3), PRIMARY KEY (organization_id,role_key,screen));
ALTER TABLE role_screens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS role_screens_read ON role_screens;
CREATE POLICY role_screens_read ON role_screens FOR SELECT TO authenticated USING (is_member(organization_id));
GRANT SELECT ON role_screens TO authenticated;
DELETE FROM role_screens;
INSERT INTO role_screens (organization_id,role_key,screen,level)
SELECT o.id, v.role_key, v.tela, v.level FROM organizations o, (VALUES
 ('PROPRIETARIO','visao-geral',3),('PROPRIETARIO','kanban',3),('PROPRIETARIO','leads-frios',3),('PROPRIETARIO','contatos',3),('PROPRIETARIO','clientes',3),('PROPRIETARIO','financeiro',3),('PROPRIETARIO','emails',3),('PROPRIETARIO','funis',3),('PROPRIETARIO','tarefas',3),('PROPRIETARIO','conversas',3),('PROPRIETARIO','whatsapp',3),('PROPRIETARIO','metas',3),('PROPRIETARIO','equipe',3),('PROPRIETARIO','planos',3),('PROPRIETARIO','suporte',3),
 ('ADMINISTRADOR','visao-geral',3),('ADMINISTRADOR','kanban',3),('ADMINISTRADOR','leads-frios',3),('ADMINISTRADOR','contatos',3),('ADMINISTRADOR','clientes',3),('ADMINISTRADOR','financeiro',3),('ADMINISTRADOR','emails',3),('ADMINISTRADOR','funis',3),('ADMINISTRADOR','tarefas',3),('ADMINISTRADOR','conversas',3),('ADMINISTRADOR','whatsapp',3),('ADMINISTRADOR','metas',3),('ADMINISTRADOR','equipe',3),('ADMINISTRADOR','planos',3),('ADMINISTRADOR','suporte',3),
 ('GESTOR','visao-geral',3),('GESTOR','kanban',3),('GESTOR','leads-frios',3),('GESTOR','contatos',3),('GESTOR','clientes',3),('GESTOR','financeiro',2),('GESTOR','emails',0),('GESTOR','funis',3),('GESTOR','tarefas',0),('GESTOR','conversas',0),('GESTOR','whatsapp',0),('GESTOR','metas',3),('GESTOR','equipe',1),('GESTOR','planos',0),('GESTOR','suporte',1),
 ('VENDEDOR','visao-geral',1),('VENDEDOR','kanban',2),('VENDEDOR','leads-frios',2),('VENDEDOR','contatos',2),('VENDEDOR','clientes',2),('VENDEDOR','financeiro',1),('VENDEDOR','emails',0),('VENDEDOR','funis',2),('VENDEDOR','tarefas',2),('VENDEDOR','conversas',2),('VENDEDOR','whatsapp',0),('VENDEDOR','metas',1),('VENDEDOR','equipe',0),('VENDEDOR','planos',0),('VENDEDOR','suporte',0),
 ('SUPORTE','visao-geral',0),('SUPORTE','kanban',3),('SUPORTE','leads-frios',0),('SUPORTE','contatos',0),('SUPORTE','clientes',3),('SUPORTE','financeiro',3),('SUPORTE','emails',3),('SUPORTE','funis',3),('SUPORTE','tarefas',0),('SUPORTE','conversas',3),('SUPORTE','whatsapp',3),('SUPORTE','metas',0),('SUPORTE','equipe',0),('SUPORTE','planos',0),('SUPORTE','suporte',3),
 ('FINANCEIRO','visao-geral',2),('FINANCEIRO','kanban',0),('FINANCEIRO','leads-frios',0),('FINANCEIRO','contatos',1),('FINANCEIRO','clientes',1),('FINANCEIRO','financeiro',3),('FINANCEIRO','emails',0),('FINANCEIRO','funis',1),('FINANCEIRO','tarefas',1),('FINANCEIRO','conversas',0),('FINANCEIRO','whatsapp',0),('FINANCEIRO','metas',1),('FINANCEIRO','equipe',0),('FINANCEIRO','planos',2),('FINANCEIRO','suporte',2)
) v(role_key,tela,level);

-- define perfil e equipe de um membro
CREATE OR REPLACE FUNCTION crm_member_update(p_org text, p_user text, p_role text, p_team text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE me text := _require(p_org,'equipe',3); m memberships; tid text; uname text;
BEGIN
  SELECT * INTO m FROM memberships WHERE organization_id=p_org AND user_id=p_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membro não encontrado'; END IF;
  IF m.role_key='PROPRIETARIO' THEN RAISE EXCEPTION 'O perfil do proprietário não pode ser alterado'; END IF;
  IF p_role IS NOT NULL AND NOT EXISTS (SELECT 1 FROM org_roles WHERE organization_id=p_org AND role_key=p_role) THEN RAISE EXCEPTION 'Perfil inválido'; END IF;
  IF p_role='PROPRIETARIO' THEN RAISE EXCEPTION 'Só existe um proprietário'; END IF;
  tid := CASE WHEN p_team IS NULL THEN m.team_id WHEN p_team='' THEN NULL ELSE p_team END;
  IF tid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM teams WHERE id=tid AND organization_id=p_org) THEN RAISE EXCEPTION 'Equipe inválida'; END IF;
  -- coordenador sem equipe ganha a própria
  IF coalesce(p_role,m.role_key)='GESTOR' AND tid IS NULL THEN
    SELECT split_part(display_name,' ',1) INTO uname FROM users WHERE id=p_user;
    INSERT INTO teams (id,organization_id,name) VALUES ('TEAM-'||substr(md5(p_org||p_user),1,8),p_org,'Equipe '||coalesce(uname,'Coordenador'))
      ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name RETURNING id INTO tid;
  END IF;
  UPDATE memberships SET role_key=coalesce(p_role,role_key), team_id=tid,
    is_seller=CASE WHEN coalesce(p_role,role_key) IN ('SUPORTE','FINANCEIRO') THEN false ELSE true END
  WHERE id=m.id RETURNING * INTO m;
  RETURN jsonb_build_object('user_id',m.user_id,'role',m.role_key,'team_id',m.team_id);
END $$;
REVOKE ALL ON FUNCTION crm_member_update(text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION crm_member_update(text,text,text,text) TO authenticated;

-- equipes reais (Floot): Eduardo, Conrado e Neiva coordenam; Mesley é da equipe do Eduardo
UPDATE memberships SET role_key='SUPORTE', is_seller=false WHERE organization_id='ORG-000001' AND user_id='USR-000002';
INSERT INTO teams (id,organization_id,name) VALUES
 ('TEAM-EDUARDO','ORG-000001','Equipe Eduardo'),('TEAM-CONRADO','ORG-000001','Equipe Conrado'),('TEAM-NEIVA','ORG-000001','Equipe Neiva')
 ON CONFLICT (id) DO NOTHING;
UPDATE memberships SET role_key='GESTOR', team_id='TEAM-EDUARDO' WHERE organization_id='ORG-000001' AND user_id='USR-000008';
UPDATE memberships SET role_key='GESTOR', team_id='TEAM-CONRADO' WHERE organization_id='ORG-000001' AND user_id='USR-000009';
UPDATE memberships SET role_key='GESTOR', team_id='TEAM-NEIVA'   WHERE organization_id='ORG-000001' AND user_id='USR-000006';
UPDATE memberships SET team_id='TEAM-EDUARDO' WHERE organization_id='ORG-000001' AND user_id='USR-000005';
