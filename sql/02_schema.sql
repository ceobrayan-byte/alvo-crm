-- =====================================================================
-- ALVO CRM — schema Postgres extraído do Floot (projeto 9610fc53-…)
-- Fonte: information_schema / pg_constraint / pg_indexes em 17/11/2026
-- Destino: Supabase (Postgres). Rodar no SQL Editor ou via migration.
--
-- O QUE ESTÁ AQUI:   30 tabelas de domínio + 6 enums + sequences de ID.
-- O QUE NÃO ESTÁ:    sessions, user_passwords, login_attempts,
--                    password_reset_codes, oauth_access_token
--                    (autenticação — usar Supabase Auth; ver 01_CONTEXTO)
--                    alvo_commission_migration_backups / _plans e
--                    alvo_company_forecast_link_plans (artefatos de
--                    migrações pontuais já concluídas no Floot).
--
-- SEM DADOS: este arquivo cria só a estrutura. Nenhuma linha foi copiada.
-- =====================================================================

-- ---------- Enums ----------
CREATE TYPE commission_entry_status AS ENUM ('PREVISTA','CONFIRMADA','LIBERADA','PAGA','RETIDA','ESTORNADA');
CREATE TYPE event_status            AS ENUM ('PENDENTE','PROCESSANDO','PROCESSADO','ERRO','IGNORADO');
CREATE TYPE integration_health      AS ENUM ('CONECTADO','PENDENTE','ERRO','DESATIVADO');
CREATE TYPE task_status             AS ENUM ('PENDENTE','EM_ANDAMENTO','CONCLUIDA','CANCELADA');
CREATE TYPE user_role               AS ENUM ('ADMIN','GESTOR_COMERCIAL','VENDEDOR','SUPORTE','FINANCEIRO','SDR_IA','IA_GERENCIAL','COORDENADOR');
CREATE TYPE user_status             AS ENUM ('CONVIDADO','ATIVO','SUSPENSO','INATIVO','DESLIGADO');

-- ---------- Sequences dos IDs com prefixo (ADM-000001, LEAD-000001, …) ----------
-- Depois de importar dados: SELECT setval('<seq>', (SELECT max(substring(id from '\d+$')::bigint) FROM <tabela>));
CREATE SEQUENCE administrator_id_seq;
CREATE SEQUENCE product_id_seq;
CREATE SEQUENCE user_id_seq;
CREATE SEQUENCE commission_rule_id_seq;
CREATE SEQUENCE group_id_seq;
CREATE SEQUENCE lead_id_seq;
CREATE SEQUENCE client_id_seq;
CREATE SEQUENCE support_case_id_seq;
CREATE SEQUENCE sale_id_seq;
CREATE SEQUENCE installment_id_seq;
CREATE SEQUENCE commission_id_seq;
CREATE SEQUENCE contemplation_id_seq;
CREATE SEQUENCE document_id_seq;
CREATE SEQUENCE call_id_seq;
CREATE SEQUENCE interaction_id_seq;
CREATE SEQUENCE simulation_id_seq;
CREATE SEQUENCE task_id_seq;
CREATE SEQUENCE goal_id_seq;

-- ---------- Cadastros base ----------
CREATE TABLE administrators (
  id text PRIMARY KEY DEFAULT ('ADM-' || lpad(nextval('administrator_id_seq')::text, 6, '0')),
  name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id text PRIMARY KEY DEFAULT ('PROD-' || lpad(nextval('product_id_seq')::text, 6, '0')),
  administrator_id text REFERENCES administrators(id) ON DELETE SET NULL,
  name text NOT NULL,
  category text,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id text PRIMARY KEY DEFAULT ('USR-' || lpad(nextval('user_id_seq')::text, 6, '0')),
  display_name text NOT NULL,
  corporate_email text UNIQUE,
  phone text,
  role user_role NOT NULL,
  team text,
  manager_user_id text REFERENCES users(id) ON DELETE SET NULL,
  status user_status NOT NULL DEFAULT 'ATIVO',
  started_at timestamptz,
  ended_at timestamptz,
  last_access_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
  -- Sugestão para o Supabase Auth (não existe no Floot):
  -- , auth_user_id uuid UNIQUE REFERENCES auth.users(id)
);

CREATE TABLE crm_regions (
  id text PRIMARY KEY,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE commission_rule_versions (
  id text PRIMARY KEY DEFAULT ('REGCOM-' || lpad(nextval('commission_rule_id_seq')::text, 6, '0')),
  rule_code text NOT NULL,
  version integer NOT NULL,
  administrator_id text REFERENCES administrators(id) ON DELETE SET NULL,
  product_id text REFERENCES products(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'RASCUNHO',
  valid_from date,
  valid_to date,
  rule_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_code, version)
);

CREATE TABLE consortium_groups (
  id text PRIMARY KEY DEFAULT ('GRP-' || lpad(nextval('group_id_seq')::text, 6, '0')),
  administrator_id text NOT NULL REFERENCES administrators(id),
  product_id text REFERENCES products(id) ON DELETE SET NULL,
  group_code text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (administrator_id, group_code)
);

-- ---------- Funil comercial ----------
CREATE TABLE leads (
  id text PRIMARY KEY DEFAULT ('LEAD-' || lpad(nextval('lead_id_seq')::text, 6, '0')),
  legacy_id text UNIQUE,
  external_source text,
  external_id text,
  owner_user_id text REFERENCES users(id) ON DELETE SET NULL,
  name text NOT NULL,
  phone text,
  email text,
  cpf_cnpj text,
  origin text,
  channel text,
  campaign text,
  ad_set text,
  ad text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  product_interest text,
  desired_credit numeric,
  stage text,
  status text NOT NULL DEFAULT 'ATIVO',
  source_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (external_source, external_id)
);
CREATE INDEX leads_owner_user_idx   ON leads (owner_user_id);
CREATE INDEX leads_status_stage_idx ON leads (status, stage);

CREATE TABLE clients (
  id text PRIMARY KEY DEFAULT ('CLI-' || lpad(nextval('client_id_seq')::text, 6, '0')),
  lead_id text UNIQUE REFERENCES leads(id) ON DELETE SET NULL,
  owner_user_id text REFERENCES users(id) ON DELETE SET NULL,
  name text NOT NULL,
  cpf_cnpj text,
  phone text,
  email text,
  city text,
  state text,
  person_type text,
  status text NOT NULL DEFAULT 'ATIVO',
  drive_folder_id text,
  drive_folder_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX clients_owner_user_idx ON clients (owner_user_id);

CREATE TABLE support_cases (
  id text PRIMARY KEY DEFAULT ('SUP-' || lpad(nextval('support_case_id_seq')::text, 6, '0')),
  lead_id text REFERENCES leads(id) ON DELETE SET NULL,
  client_id text REFERENCES clients(id) ON DELETE SET NULL,
  seller_user_id text REFERENCES users(id) ON DELETE SET NULL,
  support_user_id text REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'DOCUMENTACAO_PENDENTE',
  docs_status text,
  first_payment_status text,
  contract_status text,
  accepted boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (lead_id IS NOT NULL OR client_id IS NOT NULL)
);
CREATE INDEX support_cases_seller_idx  ON support_cases (seller_user_id);
CREATE INDEX support_cases_support_idx ON support_cases (support_user_id);

CREATE TABLE sales (
  id text PRIMARY KEY DEFAULT ('VEN-' || lpad(nextval('sale_id_seq')::text, 6, '0')),
  client_id text NOT NULL REFERENCES clients(id),
  support_case_id text REFERENCES support_cases(id) ON DELETE SET NULL,
  seller_user_id text REFERENCES users(id) ON DELETE SET NULL,
  administrator_id text REFERENCES administrators(id) ON DELETE SET NULL,
  product_id text REFERENCES products(id) ON DELETE SET NULL,
  group_id text REFERENCES consortium_groups(id) ON DELETE SET NULL,
  quota text,
  credit numeric NOT NULL CHECK (credit > 0),
  term integer NOT NULL CHECK (term > 0),
  installment numeric,
  contemplation_type text,
  bid_percentage numeric,
  bid_value numeric,
  status text NOT NULL DEFAULT 'RASCUNHO',
  commission_rule_version_id text REFERENCES commission_rule_versions(id) ON DELETE SET NULL,
  sale_date date,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sales_client_idx ON sales (client_id);
CREATE INDEX sales_seller_idx ON sales (seller_user_id);

-- ---------- Financeiro / comissões ----------
CREATE TABLE client_installments (
  id text PRIMARY KEY DEFAULT ('PAR-' || lpad(nextval('installment_id_seq')::text, 6, '0')),
  sale_id text NOT NULL REFERENCES sales(id),
  installment_number integer NOT NULL CHECK (installment_number > 0),
  due_date date,
  amount numeric,
  status text NOT NULL DEFAULT 'PENDENTE',
  paid_at timestamptz,
  source text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sale_id, installment_number)
);

CREATE TABLE commission_ledger (
  id text PRIMARY KEY DEFAULT ('COM-' || lpad(nextval('commission_id_seq')::text, 6, '0')),
  sale_id text NOT NULL REFERENCES sales(id),
  event_code text NOT NULL,
  sequence integer NOT NULL DEFAULT 1,
  rate numeric,
  amount numeric NOT NULL DEFAULT 0,
  status commission_entry_status NOT NULL DEFAULT 'PREVISTA',
  due_date date,
  confirmed_at timestamptz,
  released_at timestamptz,
  paid_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sale_id, event_code, sequence)
);
CREATE INDEX commission_ledger_sale_status_idx ON commission_ledger (sale_id, status);

CREATE TABLE contemplations (
  id text PRIMARY KEY DEFAULT ('CONT-' || lpad(nextval('contemplation_id_seq')::text, 6, '0')),
  sale_id text NOT NULL REFERENCES sales(id),
  contemplation_type text,
  contemplation_date date,
  bid_percentage numeric,
  bid_value numeric,
  status text NOT NULL DEFAULT 'PENDENTE',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- Relacionamento, agenda e tarefas ----------
CREATE TABLE documents (
  id text PRIMARY KEY DEFAULT ('DOC-' || lpad(nextval('document_id_seq')::text, 6, '0')),
  client_id text REFERENCES clients(id) ON DELETE SET NULL,
  sale_id text REFERENCES sales(id) ON DELETE SET NULL,
  support_case_id text REFERENCES support_cases(id) ON DELETE SET NULL,
  document_type text NOT NULL,
  file_name text,
  drive_file_id text NOT NULL UNIQUE,
  drive_url text NOT NULL,
  status text NOT NULL DEFAULT 'ATIVO',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX documents_client_idx ON documents (client_id);

CREATE TABLE calls (
  id text PRIMARY KEY DEFAULT ('CALL-' || lpad(nextval('call_id_seq')::text, 6, '0')),
  lead_id text REFERENCES leads(id) ON DELETE SET NULL,
  client_id text REFERENCES clients(id) ON DELETE SET NULL,
  owner_user_id text REFERENCES users(id) ON DELETE SET NULL,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'AGENDADA',
  calendar_event_id text,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE interactions (
  id text PRIMARY KEY DEFAULT ('INT-' || lpad(nextval('interaction_id_seq')::text, 6, '0')),
  lead_id text REFERENCES leads(id) ON DELETE SET NULL,
  client_id text REFERENCES clients(id) ON DELETE SET NULL,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  channel text NOT NULL,
  direction text,
  interaction_type text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE simulations (
  id text PRIMARY KEY DEFAULT ('SIM-' || lpad(nextval('simulation_id_seq')::text, 6, '0')),
  lead_id text REFERENCES leads(id) ON DELETE SET NULL,
  client_id text REFERENCES clients(id) ON DELETE SET NULL,
  created_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  administrator_id text REFERENCES administrators(id) ON DELETE SET NULL,
  product_id text REFERENCES products(id) ON DELETE SET NULL,
  credit numeric,
  term integer,
  input_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tasks (
  id text PRIMARY KEY DEFAULT ('TAR-' || lpad(nextval('task_id_seq')::text, 6, '0')),
  lead_id text REFERENCES leads(id) ON DELETE SET NULL,
  client_id text REFERENCES clients(id) ON DELETE SET NULL,
  sale_id text REFERENCES sales(id) ON DELETE SET NULL,
  assigned_user_id text REFERENCES users(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'MEDIA',
  status task_status NOT NULL DEFAULT 'PENDENTE',
  due_at timestamptz,
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tasks_assigned_status_idx ON tasks (assigned_user_id, status);

CREATE TABLE goals (
  id text PRIMARY KEY DEFAULT ('META-' || lpad(nextval('goal_id_seq')::text, 6, '0')),
  scope_type text NOT NULL,
  scope_id text,
  period_start date NOT NULL,
  period_end date NOT NULL,
  metric text NOT NULL,
  target_value numeric NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- Base fria ----------
CREATE TABLE cold_import_batches (
  id text PRIMARY KEY,
  filename text NOT NULL,
  total integer NOT NULL,
  accepted integer NOT NULL DEFAULT 0,
  duplicates integer NOT NULL DEFAULT 0,
  invalid integer NOT NULL DEFAULT 0,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cold_contacts (
  id text PRIMARY KEY,
  phone text NOT NULL UNIQUE,
  name text NOT NULL,
  name_key text NOT NULL,
  email text NOT NULL DEFAULT '',
  origin text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'COLD' CHECK (status IN ('COLD','CLAIMED')),
  import_batch text NOT NULL,
  source_row integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_lead_id text,
  legacy_id text
);
CREATE INDEX cold_contacts_status_id ON cold_contacts (status, id);
CREATE UNIQUE INDEX cold_contacts_legacy_id ON cold_contacts (legacy_id) WHERE legacy_id IS NOT NULL;

-- ---------- Integrações, eventos e auditoria ----------
CREATE TABLE integration_status (
  id text PRIMARY KEY,
  integration_key text NOT NULL UNIQUE,
  health integration_health NOT NULL DEFAULT 'PENDENTE',
  last_sync_at timestamptz,
  last_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE outbox_events (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status event_status NOT NULL DEFAULT 'PENDENTE',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX outbox_events_status_idx ON outbox_events (status, created_at);

CREATE TABLE idempotency_keys (
  key text PRIMARY KEY,
  operation text NOT NULL,
  entity_type text,
  entity_id text,
  result_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

CREATE TABLE audit_log (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  actor_user_id text REFERENCES users(id) ON DELETE SET NULL,
  actor_type text NOT NULL DEFAULT 'USER',
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  action text NOT NULL,
  before_data jsonb,
  after_data jsonb,
  source text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_entity_idx ON audit_log (entity_type, entity_id, created_at DESC);

-- ---------- Ponte com o Portal do Consorciado ----------
CREATE TABLE portal_quota_eligibility (
  sale_id text PRIMARY KEY REFERENCES sales(id) ON DELETE RESTRICT,
  customer_id text NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  administrator text NOT NULL,
  group_code text NOT NULL,
  quota_code text NOT NULL,
  status text NOT NULL CHECK (status IN ('APPROVED','OWNER_APPROVED','BLOCKED')),
  source_type text NOT NULL,
  source_reference text NOT NULL,
  source_date date NOT NULL,
  source_sha256 text,
  reason text NOT NULL,
  reviewer text NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  revision integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT portal_quota_eligibility_source_sha256_check CHECK (source_sha256 IS NULL OR source_sha256 ~ '^[a-f0-9]{64}$'),
  CONSTRAINT portal_quota_eligibility_source_type_check CHECK (
       (status = 'APPROVED'       AND source_type = 'OFFICIAL_ADMIN_QUOTA_REPORT')
    OR (status = 'OWNER_APPROVED' AND source_type = 'ALVO_OWNER_PORTAL_ONLY')
    OR (status = 'BLOCKED'        AND source_type IN ('OPERATIONAL_BLOCK','OFFICIAL_ADMIN_QUOTA_REPORT'))),
  CONSTRAINT portal_quota_reason_not_blank CHECK (length(trim(reason)) >= 12),
  CONSTRAINT portal_quota_source_not_blank CHECK (length(trim(source_reference)) >= 8)
);

CREATE TABLE portal_quota_eligibility_events (
  event_id text PRIMARY KEY,
  sale_id text NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('APPROVED','BLOCKED')),
  previous_status text,
  source_type text NOT NULL,
  source_reference text NOT NULL,
  source_date date NOT NULL,
  source_sha256 text,
  reason text NOT NULL,
  reviewer text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX portal_quota_events_sale_idx ON portal_quota_eligibility_events (sale_id, recorded_at DESC);

CREATE TABLE portal_customer_requests (
  request_id text PRIMARY KEY,
  sale_id text NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
  customer_id text NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('BOLETO','LANCE')),
  status text NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED','IN_REVIEW','COMPLETED','REJECTED')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  handled_by text,
  handling_note text
);
CREATE INDEX portal_customer_requests_sale_idx   ON portal_customer_requests (sale_id, created_at DESC);
CREATE INDEX portal_customer_requests_status_idx ON portal_customer_requests (status, created_at DESC);

-- ---------- Estado legado (fonte de compatibilidade) ----------
-- No Floot, vários módulos ainda leem/gravam aqui (id 'alvo-v13', ~266 KB, revision 7588).
-- Ver 01_CONTEXTO, seção "Risco principal".
CREATE TABLE app_state (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  revision bigint NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE alvo_schema_versions (
  version integer PRIMARY KEY,
  description text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================================
-- SEGURANÇA (Supabase): o PostgREST expõe tabelas do schema public pela
-- chave anon. Sem RLS, qualquer pessoa com a URL do projeto leria CPF/CNPJ,
-- telefones e comissões. Ligar RLS em TUDO e não criar policy alguma deixa
-- as tabelas acessíveis apenas pelo servidor (service_role / conexão direta).
-- Policies por perfil só devem ser criadas depois, de forma deliberada.
-- =====================================================================
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
