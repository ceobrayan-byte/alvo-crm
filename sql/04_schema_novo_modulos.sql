-- =====================================================================
-- ALVO CRM — DELTA DE SCHEMA PARA O NOVO DASHBOARD (multi-organização)
-- Roda DEPOIS de 02_schema.sql. Ver 03_ESPECIFICACAO_NOVO_DASHBOARD.md.
--
-- O QUE ENTRA: organizações e vínculos, perfis e permissões editáveis,
-- convites, funis configuráveis e negócios, chat compartilhado, instâncias
-- de WhatsApp (oficial e não oficial), gamificação, suporte interno
-- (support_tickets), planos, assinaturas e faturas, notificações.
--
-- O QUE NÃO MUDA: as 30 tabelas do Floot continuam como estão. Recebem apenas
-- colunas novas e anuláveis (organization_id etc.). Não há dados aqui.
--
-- SUPOSIÇÕES A CONFIRMAR:
--  1. A ALVO é a organização ORG-000001 (plano "corporativo" é um valor
--     provisório). Dados já existentes (leads, vendas, tarefas) são
--     vinculados a ela na carga; depois, SET NOT NULL em organization_id.
--  2. A autenticação é o Supabase Auth: users.auth_user_id aponta para
--     auth.users.id. As funções de RLS usam auth.uid().
--  3. Segredos (token da API oficial, sessão do QR Code) NUNCA ficam nestas
--     tabelas. whatsapp_instances guarda só uma referência (secret_ref) ao
--     cofre (Supabase Vault ou variável de ambiente do servidor).
-- =====================================================================
BEGIN;

-- ---------- enums ----------
CREATE TYPE stage_kind           AS ENUM ('ABERTA','GANHA','PERDIDA');
CREATE TYPE invitation_status    AS ENUM ('PENDENTE','ACEITO','EXPIRADO','REVOGADO');
CREATE TYPE wa_kind              AS ENUM ('OFICIAL','NAO_OFICIAL');
CREATE TYPE wa_state             AS ENUM ('CONECTADA','DESCONECTADA');
CREATE TYPE conversation_status  AS ENUM ('ABERTA','RESOLVIDA');
CREATE TYPE message_direction    AS ENUM ('ENTRADA','SAIDA','NOTA','SISTEMA');
CREATE TYPE ticket_status        AS ENUM ('ABERTO','EM_ATENDIMENTO','AGUARDANDO_USUARIO','RESOLVIDO');
CREATE TYPE invoice_status       AS ENUM ('EM_ABERTO','PAGO','CANCELADO');
CREATE TYPE challenge_scope      AS ENUM ('INDIVIDUAL','EQUIPE');
CREATE TYPE data_scope           AS ENUM ('PROPRIO','EQUIPE','ORGANIZACAO');

-- ---------- sequences de ID (mesmo padrão prefixado do Floot) ----------
CREATE SEQUENCE organization_id_seq;  CREATE SEQUENCE membership_id_seq;
CREATE SEQUENCE team_id_seq;          CREATE SEQUENCE invitation_id_seq;
CREATE SEQUENCE pipeline_id_seq;      CREATE SEQUENCE stage_id_seq;
CREATE SEQUENCE deal_id_seq;          CREATE SEQUENCE conversation_id_seq;
CREATE SEQUENCE wa_instance_id_seq;   CREATE SEQUENCE wa_template_id_seq;
CREATE SEQUENCE challenge_id_seq;     CREATE SEQUENCE ticket_id_seq;
CREATE SEQUENCE subscription_id_seq;  CREATE SEQUENCE invoice_id_seq;

-- ---------- planos (catálogo global) ----------
CREATE TABLE plans (
  key text PRIMARY KEY,
  name text NOT NULL,
  price_per_user_month numeric(10,2) NOT NULL CHECK (price_per_user_month >= 0),
  max_users integer NOT NULL,
  max_wa_instances integer NOT NULL,
  max_pipelines integer NOT NULL,
  multi_org boolean NOT NULL DEFAULT false,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true
);

-- ---------- organizações ----------
CREATE TABLE organizations (
  id text PRIMARY KEY DEFAULT ('ORG-' || lpad(nextval('organization_id_seq')::text, 6, '0')),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  city text,
  timezone text NOT NULL DEFAULT 'America/Cuiaba',
  plan_key text NOT NULL REFERENCES plans(key),
  seats integer NOT NULL DEFAULT 1 CHECK (seats >= 1),
  billing_method text NOT NULL DEFAULT 'PIX' CHECK (billing_method IN ('PIX','CARTAO','BOLETO')),
  cycle_start_day smallint NOT NULL DEFAULT 15 CHECK (cycle_start_day BETWEEN 1 AND 28),
  goal_credit numeric,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE;  -- REFERENCES auth.users(id) no Supabase

CREATE TABLE teams (
  id text PRIMARY KEY DEFAULT ('EQP-' || lpad(nextval('team_id_seq')::text, 6, '0')),
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  UNIQUE (organization_id, name)
);

-- ---------- perfis e permissões por organização ----------
CREATE TABLE org_roles (
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role_key text NOT NULL,
  label text NOT NULL,
  data_scope data_scope NOT NULL DEFAULT 'PROPRIO',
  is_system boolean NOT NULL DEFAULT false,      -- proprietário não pode ser editado
  PRIMARY KEY (organization_id, role_key)
);
CREATE TABLE role_permissions (
  organization_id text NOT NULL,
  role_key text NOT NULL,
  module text NOT NULL CHECK (module IN ('visao-geral','funis','contatos','tarefas','conversas','whatsapp','metas','equipe','planos','suporte')),
  level smallint NOT NULL CHECK (level BETWEEN 0 AND 3),   -- 0 sem acesso, 1 ver, 2 editar, 3 total
  PRIMARY KEY (organization_id, role_key, module),
  FOREIGN KEY (organization_id, role_key) REFERENCES org_roles(organization_id, role_key) ON DELETE CASCADE
);

CREATE TABLE memberships (
  id text PRIMARY KEY DEFAULT ('MBR-' || lpad(nextval('membership_id_seq')::text, 6, '0')),
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_key text NOT NULL,
  team_id text REFERENCES teams(id) ON DELETE SET NULL,
  job_title text,
  status text NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO','INATIVO')),   -- INATIVO libera o assento
  is_seller boolean NOT NULL DEFAULT true,
  last_access_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id),
  FOREIGN KEY (organization_id, role_key) REFERENCES org_roles(organization_id, role_key)
);
CREATE INDEX memberships_user_idx ON memberships(user_id) WHERE status = 'ATIVO';

CREATE TABLE invitations (
  id text PRIMARY KEY DEFAULT ('CVT-' || lpad(nextval('invitation_id_seq')::text, 6, '0')),
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role_key text NOT NULL,
  team_id text REFERENCES teams(id) ON DELETE SET NULL,
  token_hash text NOT NULL UNIQUE,               -- guardar só o hash; o token vai no e-mail
  status invitation_status NOT NULL DEFAULT 'PENDENTE',
  invited_by text REFERENCES users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, role_key) REFERENCES org_roles(organization_id, role_key)
);
-- um convite pendente por e-mail e organização
CREATE UNIQUE INDEX invitations_pending_uidx ON invitations (organization_id, lower(email)) WHERE status = 'PENDENTE';

-- ---------- funis configuráveis e negócios ----------
CREATE TABLE pipelines (
  id text PRIMARY KEY DEFAULT ('FUN-' || lpad(nextval('pipeline_id_seq')::text, 6, '0')),
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  sort smallint NOT NULL DEFAULT 0,
  UNIQUE (organization_id, key)
);
CREATE TABLE pipeline_stages (
  id text PRIMARY KEY DEFAULT ('ETP-' || lpad(nextval('stage_id_seq')::text, 6, '0')),
  pipeline_id text NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  sort smallint NOT NULL,
  probability numeric(4,3) NOT NULL DEFAULT 0 CHECK (probability BETWEEN 0 AND 1),
  kind stage_kind NOT NULL DEFAULT 'ABERTA',
  UNIQUE (pipeline_id, key)
);
CREATE TABLE deals (
  id text PRIMARY KEY DEFAULT ('NEG-' || lpad(nextval('deal_id_seq')::text, 6, '0')),
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  pipeline_id text NOT NULL REFERENCES pipelines(id),
  stage_id text NOT NULL REFERENCES pipeline_stages(id),
  lead_id text REFERENCES leads(id) ON DELETE SET NULL,
  client_id text REFERENCES clients(id) ON DELETE SET NULL,
  sale_id text REFERENCES sales(id) ON DELETE SET NULL,   -- preenchido ao efetivar a venda
  owner_user_id text REFERENCES users(id) ON DELETE SET NULL,
  credit_value numeric NOT NULL DEFAULT 0 CHECK (credit_value >= 0),
  product_id text REFERENCES products(id) ON DELETE SET NULL,
  administrator_id text REFERENCES administrators(id) ON DELETE SET NULL,
  temperature text NOT NULL DEFAULT 'MORNO' CHECK (temperature IN ('QUENTE','MORNO','FRIO')),
  stage_entered_at timestamptz NOT NULL DEFAULT now(),
  lost_reason text,
  won_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (lead_id IS NOT NULL OR client_id IS NOT NULL)
);
CREATE INDEX deals_org_stage_idx ON deals(organization_id, pipeline_id, stage_id);
CREATE INDEX deals_owner_idx ON deals(owner_user_id);
CREATE TABLE deal_stage_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  deal_id text NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  from_stage_id text REFERENCES pipeline_stages(id),
  to_stage_id text NOT NULL REFERENCES pipeline_stages(id),
  changed_by text REFERENCES users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

-- colunas novas nas tabelas existentes (anuláveis; preencher na carga)
ALTER TABLE leads         ADD COLUMN IF NOT EXISTS organization_id text REFERENCES organizations(id),
                          ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
ALTER TABLE clients       ADD COLUMN IF NOT EXISTS organization_id text REFERENCES organizations(id);
ALTER TABLE sales         ADD COLUMN IF NOT EXISTS organization_id text REFERENCES organizations(id);
ALTER TABLE goals         ADD COLUMN IF NOT EXISTS organization_id text REFERENCES organizations(id);
ALTER TABLE tasks         ADD COLUMN IF NOT EXISTS organization_id text REFERENCES organizations(id),
                          ADD COLUMN IF NOT EXISTS deal_id text REFERENCES deals(id) ON DELETE SET NULL,
                          ADD COLUMN IF NOT EXISTS task_type text CHECK (task_type IN ('LIGACAO','REUNIAO','WHATSAPP','DOCUMENTOS','EMAIL'));
CREATE INDEX IF NOT EXISTS leads_org_idx ON leads(organization_id);
CREATE INDEX IF NOT EXISTS tasks_org_idx ON tasks(organization_id, assigned_user_id, due_at);

-- ---------- WhatsApp ----------
CREATE TABLE whatsapp_instances (
  id text PRIMARY KEY DEFAULT ('WAI-' || lpad(nextval('wa_instance_id_seq')::text, 6, '0')),
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind wa_kind NOT NULL,
  phone_e164 text NOT NULL,
  state wa_state NOT NULL DEFAULT 'DESCONECTADA',
  provider_ref text,             -- OFICIAL: Phone Number ID. NAO_OFICIAL: id da sessão no provedor
  secret_ref text,               -- referência ao segredo no cofre. Nunca o token em si.
  quality text CHECK (quality IN ('ALTA','MEDIA','BAIXA')),
  message_tier text,
  config jsonb NOT NULL DEFAULT '{"auto_distribution":true,"mode":"rodizio","business_hours":true}'::jsonb,
  connected_since timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, phone_e164)
);
CREATE TABLE whatsapp_templates (
  id text PRIMARY KEY DEFAULT ('WAT-' || lpad(nextval('wa_template_id_seq')::text, 6, '0')),
  instance_id text NOT NULL REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL,
  language text NOT NULL DEFAULT 'pt_BR',
  status text NOT NULL CHECK (status IN ('APROVADO','EM_ANALISE','REJEITADO')),
  UNIQUE (instance_id, name)
);

-- ---------- chat compartilhado ----------
CREATE TABLE conversations (
  id text PRIMARY KEY DEFAULT ('CNV-' || lpad(nextval('conversation_id_seq')::text, 6, '0')),
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  instance_id text NOT NULL REFERENCES whatsapp_instances(id),
  lead_id text REFERENCES leads(id) ON DELETE SET NULL,
  client_id text REFERENCES clients(id) ON DELETE SET NULL,
  external_contact text NOT NULL,                 -- telefone E.164 do contato
  assignee_user_id text REFERENCES users(id) ON DELETE SET NULL,   -- NULL = fila
  status conversation_status NOT NULL DEFAULT 'ABERTA',
  last_inbound_at timestamptz,                    -- base da janela de 24 h (API oficial)
  last_message_at timestamptz,
  first_reply_at timestamptz,                     -- base do tempo de primeira resposta e do XP
  unread_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instance_id, external_contact)
);
CREATE INDEX conversations_inbox_idx ON conversations(organization_id, status, assignee_user_id, last_message_at DESC);
CREATE TABLE messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id text NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  direction message_direction NOT NULL,
  body text NOT NULL,
  sent_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  template_id text REFERENCES whatsapp_templates(id) ON DELETE SET NULL,
  provider_message_id text,
  delivery_status text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_conv_idx ON messages(conversation_id, created_at);
-- idempotência do webhook: o mesmo evento do provedor não grava duas vezes
CREATE UNIQUE INDEX messages_provider_uidx ON messages(conversation_id, provider_message_id) WHERE provider_message_id IS NOT NULL;

-- ---------- gamificação ----------
CREATE TABLE gamification_levels (
  level smallint PRIMARY KEY,
  title text NOT NULL,
  xp_threshold integer NOT NULL UNIQUE
);
CREATE TABLE xp_rules (
  action_key text PRIMARY KEY,
  label text NOT NULL,
  xp integer NOT NULL CHECK (xp > 0),
  daily_cap integer NOT NULL DEFAULT 0 CHECK (daily_cap >= 0)    -- 0 = sem limite
);
CREATE TABLE xp_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_key text NOT NULL REFERENCES xp_rules(action_key),
  xp integer NOT NULL CHECK (xp > 0),                           -- nunca negativo: não há punição
  ref_type text NOT NULL,
  ref_id text NOT NULL,
  occurred_on date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id, action_key, ref_type, ref_id)   -- o mesmo fato não pontua duas vezes
);
CREATE INDEX xp_events_rank_idx ON xp_events(organization_id, occurred_on, user_id);
CREATE TABLE achievements (
  key text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  tier text NOT NULL CHECK (tier IN ('I','II','III')),
  metric_key text NOT NULL,
  target integer NOT NULL CHECK (target > 0)
);
CREATE TABLE user_achievements (
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_key text NOT NULL REFERENCES achievements(key),
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id, achievement_key)
);
CREATE TABLE challenges (
  id text PRIMARY KEY DEFAULT ('DES-' || lpad(nextval('challenge_id_seq')::text, 6, '0')),
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  scope challenge_scope NOT NULL,
  title text NOT NULL,
  description text,
  metric_key text NOT NULL,
  target integer NOT NULL CHECK (target > 0),
  reward_xp integer NOT NULL CHECK (reward_xp BETWEEN 10 AND 150),   -- teto contra distorção de foco
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  created_by text REFERENCES users(id) ON DELETE SET NULL,
  CHECK (ends_on >= starts_on)
);
CREATE TABLE challenge_claims (
  challenge_id text NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  xp integer NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (challenge_id, user_id)                                 -- resgate único
);
CREATE TABLE gamification_prefs (
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  paused boolean NOT NULL DEFAULT false,            -- modo pausa: congela sequência e metas diárias
  show_in_ranking boolean NOT NULL DEFAULT true,    -- a gestão sempre enxerga os números
  PRIMARY KEY (organization_id, user_id)
);
-- ranking do ciclo (15 a 14): XP somado por pessoa
CREATE VIEW v_cycle_xp WITH (security_invoker = true) AS
SELECT e.organization_id, e.user_id,
       CASE WHEN extract(day FROM e.occurred_on) >= o.cycle_start_day
            THEN date_trunc('month', e.occurred_on)::date + (o.cycle_start_day - 1)
            ELSE (date_trunc('month', e.occurred_on) - interval '1 month')::date + (o.cycle_start_day - 1) END AS cycle_start,
       sum(e.xp)::integer AS xp
FROM xp_events e JOIN organizations o ON o.id = e.organization_id
GROUP BY 1, 2, 3;

-- ---------- suporte interno da plataforma (diferente de support_cases = pós-venda de consorciados) ----------
CREATE TABLE support_tickets (
  id text PRIMARY KEY DEFAULT ('CHM-' || lpad(nextval('ticket_id_seq')::text, 6, '0')),
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  opened_by text NOT NULL REFERENCES users(id),
  category text NOT NULL,
  priority text NOT NULL DEFAULT 'MEDIA' CHECK (priority IN ('BAIXA','MEDIA','ALTA')),
  status ticket_status NOT NULL DEFAULT 'ABERTO',
  title text NOT NULL,
  first_response_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE TABLE support_ticket_messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticket_id text NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_kind text NOT NULL CHECK (author_kind IN ('USUARIO','SUPORTE')),
  author_user_id text REFERENCES users(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- assinaturas, faturas, notificações ----------
CREATE TABLE subscriptions (
  id text PRIMARY KEY DEFAULT ('ASS-' || lpad(nextval('subscription_id_seq')::text, 6, '0')),
  organization_id text NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  plan_key text NOT NULL REFERENCES plans(key),
  seats integer NOT NULL CHECK (seats >= 1),
  billing_period text NOT NULL DEFAULT 'MENSAL' CHECK (billing_period IN ('MENSAL','ANUAL')),
  status text NOT NULL DEFAULT 'ATIVA' CHECK (status IN ('ATIVA','INADIMPLENTE','CANCELADA')),
  current_period_end date NOT NULL,
  gateway_customer_ref text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE invoices (
  id text PRIMARY KEY DEFAULT ('FAT-' || lpad(nextval('invoice_id_seq')::text, 6, '0')),
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  number text NOT NULL,
  due_date date NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  status invoice_status NOT NULL DEFAULT 'EM_ABERTO',
  method text,
  paid_at timestamptz,
  gateway_ref text,                       -- id da cobrança no gateway; confirmação vem por webhook assinado
  UNIQUE (organization_id, number)
);
CREATE TABLE notifications (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  body text NOT NULL,
  target_view text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications(user_id, read_at, created_at DESC);

-- ---------- dados de referência (iguais aos do protótipo) ----------
INSERT INTO plans (key,name,price_per_user_month,max_users,max_wa_instances,max_pipelines,multi_org,features) VALUES
 ('essencial','Essencial',59,5,1,1,false,'["1 funil de vendas","1 instância de WhatsApp","Contatos, tarefas e conversas","Metas e ranking da equipe"]'),
 ('equipe','Equipe',99,15,3,5,false,'["Até 5 funis","3 instâncias de WhatsApp","Permissões por perfil","Desafios e conquistas","Suporte interno com SLA"]'),
 ('corporativo','Corporativo',149,50,10,99,true,'["Funis ilimitados","10 instâncias de WhatsApp","Múltiplas organizações","Relatórios e exportações","Gerente de conta dedicado"]');
INSERT INTO gamification_levels (level,title,xp_threshold) VALUES
 (1,'Associado',0),(2,'Consultor',400),(3,'Consultor sênior',1000),(4,'Especialista',1900),(5,'Estrategista',3100),(6,'Referência',4700),(7,'Mentor',6800),(8,'Executivo',9500);
INSERT INTO xp_rules (action_key,label,xp,daily_cap) VALUES
 ('resposta','Resposta em menos de 5 min',10,60),('tarefa','Tarefa concluída em dia',5,50),('call','Call realizada',15,90),
 ('avanco','Negócio avançou de etapa',10,80),('docs','Documentação completa de primeira',30,90),
 ('venda','Venda efetivada (150 + 1 por R$ 1 mil de crédito, até +250)',150,0);
INSERT INTO achievements (key,name,description,tier,metric_key,target) VALUES
 ('primeira-venda','Primeira venda','Efetive a primeira venda na plataforma.','I','won',1),
 ('dupla','Fechamento duplo','Duas vendas efetivadas na mesma semana.','II','doubleWeek',1),
 ('carteira','Carteira saudável','Nenhuma parcela em atraso na carteira por um ciclo.','II','cleanWallet',1),
 ('agenda','Agenda em dia','Cinco dias úteis sem tarefa atrasada.','I','tidyDays',5),
 ('relampago','Resposta relâmpago','50 primeiras respostas em menos de 5 minutos.','II','fast',50),
 ('consistencia','Consistência','10 dias úteis seguidos cumprindo o contato mínimo.','II','streak',10),
 ('documentacao','Documentação limpa','5 formalizações sem correção.','I','docsClean',5),
 ('conversao','Alta conversão','Conversão de lead em venda acima de 20% no ciclo.','III','conv20',1),
 ('ritmo','Ritmo de ciclo','Bater 100% da meta individual do ciclo.','III','goalHit',1),
 ('mentor','Força de equipe','Concluir 3 desafios de equipe.','III','teamCh',3);

-- Perfis e permissões padrão de uma organização nova (mesma matriz do protótipo).
-- Ordem dos módulos: visao-geral, funis, contatos, tarefas, conversas, whatsapp, metas, equipe, planos, suporte.
CREATE FUNCTION seed_org_defaults(p_org text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  mods text[] := ARRAY['visao-geral','funis','contatos','tarefas','conversas','whatsapp','metas','equipe','planos','suporte'];
  r record; i int;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('PROPRIETARIO','Proprietário','ORGANIZACAO'::data_scope,true ,ARRAY[3,3,3,3,3,3,3,3,3,3]),
    ('ADMINISTRADOR','Administrador','ORGANIZACAO'::data_scope,false,ARRAY[3,3,3,3,3,3,3,3,3,3]),
    ('GESTOR','Gestor','EQUIPE'::data_scope,false,ARRAY[3,3,3,3,3,2,3,2,0,2]),
    ('VENDEDOR','Vendedor','PROPRIO'::data_scope,false,ARRAY[1,2,2,2,2,0,1,0,0,2]),
    ('SUPORTE','Suporte','EQUIPE'::data_scope,false,ARRAY[1,2,1,2,2,0,1,0,0,3]),
    ('FINANCEIRO','Financeiro','ORGANIZACAO'::data_scope,false,ARRAY[2,1,1,1,0,0,1,0,2,2])
  ) AS v(k,l,s,sys,lv) LOOP
    INSERT INTO org_roles (organization_id,role_key,label,data_scope,is_system) VALUES (p_org,r.k,r.l,r.s,r.sys) ON CONFLICT DO NOTHING;
    FOR i IN 1..array_length(mods,1) LOOP
      INSERT INTO role_permissions (organization_id,role_key,module,level) VALUES (p_org,r.k,mods[i],r.lv[i]) ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
  INSERT INTO pipelines (organization_id,key,name,sort) VALUES (p_org,'comercial','Comercial',1),(p_org,'posvenda','Pós-venda e suporte',2),(p_org,'reativacao','Reativação (base fria)',3) ON CONFLICT DO NOTHING;
  INSERT INTO pipeline_stages (pipeline_id,key,label,sort,probability,kind)
  SELECT p.id, v.k, v.l, v.o, v.pr, v.kd::stage_kind
  FROM pipelines p JOIN (VALUES
    ('comercial','novo','Novo lead',1,0.05,'ABERTA'),('comercial','call1','Call 1 agendada',2,0.2,'ABERTA'),('comercial','noshow','No-show / follow-up',3,0.1,'ABERTA'),
    ('comercial','call2','Call 2',4,0.4,'ABERTA'),('comercial','closer','Closer',5,0.6,'ABERTA'),('comercial','fech','Fechamento',6,0.85,'ABERTA'),
    ('comercial','ganho','Efetivada',7,1,'GANHA'),('comercial','perdido','Perdido',8,0,'PERDIDA'),
    ('posvenda','doc','Documentação pendente',1,0.7,'ABERTA'),('posvenda','form','Em formalização',2,0.85,'ABERTA'),('posvenda','corr','Em correção',3,0.75,'ABERTA'),('posvenda','efet','Efetivado',4,1,'GANHA'),
    ('reativacao','frio','Base fria',1,0.02,'ABERTA'),('reativacao','tent','Tentativa de contato',2,0.05,'ABERTA'),('reativacao','resp','Respondeu',3,0.2,'ABERTA'),('reativacao','recup','Reativado',4,1,'GANHA')
  ) AS v(pk,k,l,o,pr,kd) ON v.pk = p.key
  WHERE p.organization_id = p_org
  ON CONFLICT DO NOTHING;
END $$;

-- seed_org_defaults grava em tabelas protegidas: só o servidor (service_role) deve chamá-la.
-- No Supabase, funções novas recebem EXECUTE para anon e authenticated; aqui isso é retirado.
REVOKE ALL ON FUNCTION seed_org_defaults(text) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION seed_org_defaults(text) FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION seed_org_defaults(text) FROM authenticated';
  END IF;
END $$;

-- Organização da ALVO (provisória; ver suposição 1)
INSERT INTO organizations (id,name,slug,city,plan_key,seats,goal_credit)
VALUES ('ORG-000001','ALVO Investimentos','alvo','Cuiabá','corporativo',50,NULL);
SELECT setval('organization_id_seq', 1);
SELECT seed_org_defaults('ORG-000001');

-- ---------- funções de autorização (usadas pelas policies) ----------
-- plpgsql: auth.uid() só é resolvido na execução, então o arquivo roda também fora do Supabase.
CREATE FUNCTION my_user_id() RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN RETURN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()); END $$;

CREATE FUNCTION is_member(p_org text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM memberships m WHERE m.organization_id = p_org AND m.user_id = my_user_id() AND m.status = 'ATIVO');
$$;

CREATE FUNCTION perm_level(p_org text, p_module text) RETURNS smallint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(max(rp.level), 0)::smallint
  FROM memberships m JOIN role_permissions rp
    ON rp.organization_id = m.organization_id AND rp.role_key = m.role_key AND rp.module = p_module
  WHERE m.organization_id = p_org AND m.user_id = my_user_id() AND m.status = 'ATIVO';
$$;

-- escopo de dados: PROPRIO vê só o que é seu; EQUIPE vê a própria equipe; ORGANIZACAO vê tudo
CREATE FUNCTION can_see_owner(p_org text, p_owner text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships me JOIN org_roles r ON r.organization_id = me.organization_id AND r.role_key = me.role_key
    LEFT JOIN memberships ow ON ow.organization_id = me.organization_id AND ow.user_id = p_owner
    WHERE me.organization_id = p_org AND me.user_id = my_user_id() AND me.status = 'ATIVO'
      AND ( r.data_scope = 'ORGANIZACAO'
         OR p_owner IS NULL
         OR p_owner = me.user_id
         OR (r.data_scope = 'EQUIPE' AND me.team_id IS NOT NULL AND ow.team_id = me.team_id) )
  );
$$;

-- ---------- RLS ----------
-- Regra geral: leitura para membros da organização; escritas pelo servidor (service_role),
-- que valida a permissão do módulo antes de gravar. Policies de escrita direta pelo
-- cliente só devem existir se forem necessárias e testadas.
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['plans','organizations','teams','org_roles','role_permissions','memberships','invitations','pipelines','pipeline_stages','deals','deal_stage_history',
    'whatsapp_instances','whatsapp_templates','conversations','messages','gamification_levels','xp_rules','xp_events','achievements','user_achievements','challenges','challenge_claims',
    'gamification_prefs','support_tickets','support_ticket_messages','subscriptions','invoices','notifications']) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- catálogos (sem dado de cliente)
CREATE POLICY ler_planos        ON plans               FOR SELECT USING (true);
CREATE POLICY ler_niveis        ON gamification_levels FOR SELECT USING (true);
CREATE POLICY ler_regras_xp     ON xp_rules            FOR SELECT USING (true);
CREATE POLICY ler_conquistas    ON achievements        FOR SELECT USING (true);

-- estrutura da organização: todo membro lê
CREATE POLICY ler_org           ON organizations       FOR SELECT USING (is_member(id));
CREATE POLICY ler_equipes       ON teams               FOR SELECT USING (is_member(organization_id));
CREATE POLICY ler_perfis        ON org_roles           FOR SELECT USING (is_member(organization_id));
CREATE POLICY ler_permissoes    ON role_permissions    FOR SELECT USING (is_member(organization_id));
CREATE POLICY ler_vinculos      ON memberships         FOR SELECT USING (is_member(organization_id));
CREATE POLICY ler_funis         ON pipelines           FOR SELECT USING (is_member(organization_id));
CREATE POLICY ler_etapas        ON pipeline_stages     FOR SELECT USING (EXISTS (SELECT 1 FROM pipelines p WHERE p.id = pipeline_id AND is_member(p.organization_id)));
CREATE POLICY ler_conquistas_us ON user_achievements   FOR SELECT USING (is_member(organization_id));
CREATE POLICY ler_desafios      ON challenges          FOR SELECT USING (is_member(organization_id));
CREATE POLICY ler_resgates      ON challenge_claims    FOR SELECT USING (EXISTS (SELECT 1 FROM challenges c WHERE c.id = challenge_id AND is_member(c.organization_id)));
CREATE POLICY ler_xp            ON xp_events           FOR SELECT USING (is_member(organization_id));   -- ranking é visível; ocultar nomes é feito na consulta (show_in_ranking)
CREATE POLICY ler_prefs_gamif   ON gamification_prefs  FOR SELECT USING (user_id = my_user_id() OR perm_level(organization_id,'metas') >= 3);
CREATE POLICY gravar_prefs_gamif ON gamification_prefs FOR ALL USING (user_id = my_user_id()) WITH CHECK (user_id = my_user_id());

-- convites, planos e faturas: exigem permissão no módulo
CREATE POLICY ler_convites      ON invitations         FOR SELECT USING (perm_level(organization_id,'equipe') >= 2);
CREATE POLICY ler_assinatura    ON subscriptions       FOR SELECT USING (perm_level(organization_id,'planos') >= 1);
CREATE POLICY ler_faturas       ON invoices            FOR SELECT USING (perm_level(organization_id,'planos') >= 1);

-- dados comerciais: respeitam o escopo (próprio, equipe, organização) e a permissão do módulo
CREATE POLICY ler_negocios      ON deals               FOR SELECT USING (perm_level(organization_id,'funis') >= 1 AND can_see_owner(organization_id, owner_user_id));
CREATE POLICY ler_hist_negocio  ON deal_stage_history  FOR SELECT USING (EXISTS (SELECT 1 FROM deals d WHERE d.id = deal_id AND perm_level(d.organization_id,'funis') >= 1 AND can_see_owner(d.organization_id, d.owner_user_id)));
CREATE POLICY ler_leads         ON leads               FOR SELECT USING (organization_id IS NOT NULL AND perm_level(organization_id,'contatos') >= 1 AND can_see_owner(organization_id, owner_user_id));
CREATE POLICY ler_tarefas       ON tasks               FOR SELECT USING (organization_id IS NOT NULL AND perm_level(organization_id,'tarefas') >= 1 AND can_see_owner(organization_id, assigned_user_id));

-- conversas: fila (sem responsável) é visível a quem tem acesso; o restante segue o escopo
CREATE POLICY ler_instancias    ON whatsapp_instances  FOR SELECT USING (perm_level(organization_id,'whatsapp') >= 1);   -- secret_ref não deve ser exposto: usar view sem a coluna na API
CREATE POLICY ler_modelos       ON whatsapp_templates  FOR SELECT USING (EXISTS (SELECT 1 FROM whatsapp_instances i WHERE i.id = instance_id AND perm_level(i.organization_id,'whatsapp') >= 1));
CREATE POLICY ler_conversas     ON conversations       FOR SELECT USING (perm_level(organization_id,'conversas') >= 1 AND can_see_owner(organization_id, assignee_user_id));
CREATE POLICY ler_mensagens     ON messages            FOR SELECT USING (EXISTS (SELECT 1 FROM conversations c WHERE c.id = conversation_id AND perm_level(c.organization_id,'conversas') >= 1 AND can_see_owner(c.organization_id, c.assignee_user_id)));

-- suporte interno: o autor vê o próprio chamado; quem tem total no módulo vê todos
CREATE POLICY ler_chamados      ON support_tickets     FOR SELECT USING (opened_by = my_user_id() OR perm_level(organization_id,'suporte') >= 3);
CREATE POLICY ler_msg_chamados  ON support_ticket_messages FOR SELECT USING (EXISTS (SELECT 1 FROM support_tickets t WHERE t.id = ticket_id AND (t.opened_by = my_user_id() OR perm_level(t.organization_id,'suporte') >= 3)));
CREATE POLICY abrir_chamado     ON support_tickets     FOR INSERT WITH CHECK (opened_by = my_user_id() AND is_member(organization_id));

CREATE POLICY ler_notificacoes  ON notifications       FOR SELECT USING (user_id = my_user_id());
CREATE POLICY marcar_lida       ON notifications       FOR UPDATE USING (user_id = my_user_id()) WITH CHECK (user_id = my_user_id());

INSERT INTO alvo_schema_versions (version, description) VALUES (2, 'Delta multi-organização: perfis, funis, chat, WhatsApp, gamificação, planos, suporte');
COMMIT;
