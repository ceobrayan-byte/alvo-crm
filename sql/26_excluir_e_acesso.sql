-- 26 (20/11/2026)
-- * Excluir vendedor falhava: memberships_status_check só aceitava ATIVO/INATIVO. Agora aceita EXCLUIDO.
-- * crm_access_target(p_org,p_user): proprietário/administrador (Equipe nível 3) obtém os dados para enviar acesso.
-- * Função alvo-access: gera senha provisória, cria/atualiza o login (Supabase Auth), vincula users.auth_user_id
--   e envia o e-mail "Seu acesso ao CRM ALVO" com o link https://crm.alvoinvestimentos.com.br. No 1º acesso a pessoa
--   cria a senha definitiva (user_metadata.temp_pw). A senha provisória não é gravada no CRM.
ALTER TABLE memberships DROP CONSTRAINT IF EXISTS memberships_status_check;
ALTER TABLE memberships ADD CONSTRAINT memberships_status_check CHECK (status = ANY (ARRAY['ATIVO','INATIVO','EXCLUIDO']));
