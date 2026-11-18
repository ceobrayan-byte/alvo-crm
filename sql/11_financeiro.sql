-- 11: Financeiro / Comissões (regras copiadas do Floot: catálogo, cronogramas ALVO e vendedor, mensalidades, recebimentos e repasses)
ALTER TABLE op_cases ADD COLUMN IF NOT EXISTS admin_rate numeric;

CREATE TABLE IF NOT EXISTS commission_catalog (
  id text PRIMARY KEY, platform text NOT NULL, product text, plan text, parcel_type text,
  commission_rate numeric NOT NULL, events jsonb NOT NULL, alvo_kind text, alvo_events jsonb,
  active boolean NOT NULL DEFAULT true, source text NOT NULL DEFAULT 'ALVO_Comissao_Geral.xlsx · Floot (migrado 18/11/2026)'
);
ALTER TABLE commission_catalog ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS commission_agreements (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  seller_user_id text NOT NULL, platform text NOT NULL, percent numeric NOT NULL CHECK (percent>=0 AND percent<=100),
  effective_from date NOT NULL DEFAULT '2026-01-01', active boolean NOT NULL DEFAULT true, note text,
  created_by text, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE commission_agreements ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS fin_events (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  case_id text NOT NULL REFERENCES op_cases(id) ON DELETE CASCADE,
  seller_user_id text, kind text NOT NULL CHECK (kind IN ('ALVO','VENDEDOR')),
  event text NOT NULL, seq int NOT NULL, rate numeric, amount numeric NOT NULL DEFAULT 0, due_month date,
  status text NOT NULL DEFAULT 'Prevista' CHECK (status IN ('Prevista','Recebida','Paga')),
  actual_amount numeric, settled_on date, reference text, settled_by text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, kind, event)
);
CREATE INDEX IF NOT EXISTS fin_events_org ON fin_events (organization_id, kind, status);
ALTER TABLE fin_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS fin_installments (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  case_id text NOT NULL REFERENCES op_cases(id) ON DELETE CASCADE,
  n int NOT NULL CHECK (n BETWEEN 1 AND 12), confirmed boolean NOT NULL DEFAULT false,
  confirmed_at timestamptz, confirmed_by text, UNIQUE (case_id, n)
);
ALTER TABLE fin_installments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION _fin_alloc(p_w numeric[], p_total bigint) RETURNS bigint[]
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE n int := coalesce(array_length(p_w,1),0); s numeric := 0; vals bigint[] := '{}'; miss bigint; r record; i int;
BEGIN
  IF n=0 THEN RETURN '{}'; END IF;
  FOR i IN 1..n LOOP s := s + p_w[i]; END LOOP;
  IF s=0 THEN IF p_total<>0 THEN RAISE EXCEPTION 'Cronograma sem pesos confirmados'; END IF; RETURN array_fill(0::bigint, ARRAY[n]); END IF;
  FOR i IN 1..n LOOP vals[i] := floor(p_total*p_w[i]/s)::bigint; END LOOP;
  miss := p_total; FOR i IN 1..n LOOP miss := miss - vals[i]; END LOOP;
  FOR r IN SELECT o FROM generate_series(1,n) o ORDER BY ((p_total*p_w[o]/s)-floor(p_total*p_w[o]/s)) DESC, o LIMIT miss LOOP vals[r.o] := vals[r.o]+1; END LOOP;
  RETURN vals;
END $$;

CREATE OR REPLACE FUNCTION _fin_generate(p_case text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c op_cases; cat commission_catalog; ag commission_agreements; pct numeric; evn text[]; w numeric[]; rates numeric[] := '{}'; n int; i int; j int;
  adm numeric; alvo_pct numeric; red numeric; take numeric; cr numeric; tgt bigint; cents bigint[]; rounded bigint[] := '{}'; last_pos int := -1; diff bigint;
  mon date; num int; an text[]; ap numeric[]; amts numeric[] := '{}'; tot numeric; ssum numeric := 0; day date;
BEGIN
  SELECT * INTO c FROM op_cases WHERE id=p_case;
  IF NOT FOUND THEN RETURN; END IF;
  IF c.returned_at IS NOT NULL OR c.status<>'Efetivado' THEN DELETE FROM fin_events WHERE case_id=p_case AND status='Prevista'; RETURN; END IF;
  IF c.rule_id IS NULL OR c.credit IS NULL OR c.credit<=0 THEN RETURN; END IF;
  SELECT * INTO cat FROM commission_catalog WHERE id=c.rule_id;
  IF NOT FOUND THEN RETURN; END IF;
  DELETE FROM fin_events WHERE case_id=p_case AND status='Prevista';
  day := coalesce(c.sale_date,(now() AT TIME ZONE 'America/Cuiaba')::date);
  mon := date_trunc('month',day)::date; cr := c.credit;
  SELECT * INTO ag FROM commission_agreements WHERE organization_id=c.organization_id AND seller_user_id=c.seller_user_id AND active AND lower(platform)=lower(cat.platform) AND effective_from<=day ORDER BY effective_from DESC LIMIT 1;
  pct := coalesce(ag.percent, cat.commission_rate*100);
  SELECT array_agg(e->>'event' ORDER BY o), array_agg((e->>'weight')::numeric ORDER BY o) INTO evn, w FROM jsonb_array_elements(cat.events) WITH ORDINALITY t(e,o);
  n := array_length(evn,1);
  FOR i IN 1..n LOOP rates[i] := pct/100*w[i]; END LOOP;
  adm := coalesce(c.admin_rate,20); alvo_pct := greatest(0, 6 - greatest(0, 20-adm));
  IF cat.platform='Canopus' THEN
    red := pct/100*(1-alvo_pct/6);
    FOR i IN SELECT o FROM generate_series(1,n) o ORDER BY (CASE WHEN evn[o] ~* 'contempla' THEN 0 WHEN evn[o]='Parcela 12' THEN 1 ELSE 2 END), o DESC LOOP
      EXIT WHEN red<=0;
      take := least(rates[i],red); rates[i] := rates[i]-take; red := red-take;
    END LOOP;
  END IF;
  FOR i IN 1..n LOOP ssum := ssum + rates[i]; END LOOP;
  tgt := round(cr*ssum*100)::bigint;
  cents := _fin_alloc(rates,tgt);
  IF c.rule_id<>'CAN-8000-R50' THEN
    diff := tgt;
    FOR i IN 1..n LOOP rounded[i] := round(cr*rates[i]*100)::bigint; diff := diff-rounded[i]; IF rates[i]>0 THEN last_pos := i; END IF; END LOOP;
    IF last_pos>0 AND rounded[last_pos]+diff>=0 THEN rounded[last_pos] := rounded[last_pos]+diff; cents := rounded; END IF;
  END IF;
  FOR i IN 1..n LOOP
    num := nullif(substring(evn[i] from '^Parcela (\d+)$'),'')::int;
    INSERT INTO fin_events (organization_id,case_id,seller_user_id,kind,event,seq,rate,amount,due_month)
    VALUES (c.organization_id,c.id,c.seller_user_id,'VENDEDOR',evn[i],i,cents[i]::numeric/100/cr,cents[i]::numeric/100,CASE WHEN num IS NOT NULL THEN (mon + ((num-1)||' months')::interval)::date END)
    ON CONFLICT (case_id,kind,event) DO NOTHING;
  END LOOP;
  -- receita ALVO
  IF cat.alvo_events IS NOT NULL THEN
    SELECT array_agg(e->>'event' ORDER BY o), array_agg((e->>'pct')::numeric ORDER BY o) INTO an, ap FROM jsonb_array_elements(cat.alvo_events) WITH ORDINALITY t(e,o);
    n := array_length(an,1);
    IF cat.alvo_kind='canopus' THEN
      red := (6-alvo_pct)/100;
      FOR i IN REVERSE n..1 LOOP EXIT WHEN red<=0; take := least(ap[i]/100,red); ap[i] := (ap[i]/100-take)*100; red := red-take; END LOOP;
      tot := round(cr*alvo_pct/100,2);
    ELSIF cat.alvo_kind='cnp' THEN tot := NULL;
    ELSE tot := 0; FOR i IN 1..n LOOP tot := tot+ap[i]; END LOOP; tot := round(cr*tot/100,2);
    END IF;
    FOR i IN 1..n LOOP amts[i] := round(cr*ap[i]/100,2); END LOOP;
    IF tot IS NOT NULL THEN
      diff := 0; FOR i IN 1..n LOOP diff := diff + round(amts[i]*100)::bigint; END LOOP;
      amts[n] := amts[n] + (tot*100 - diff)/100;
    END IF;
    FOR i IN 1..n LOOP
      num := nullif(substring(an[i] from '^Parcela (\d+)$'),'')::int;
      INSERT INTO fin_events (organization_id,case_id,seller_user_id,kind,event,seq,rate,amount,due_month)
      VALUES (c.organization_id,c.id,c.seller_user_id,'ALVO',an[i],i,ap[i]/100,amts[i],CASE WHEN num IS NOT NULL THEN (mon + ((num-1)||' months')::interval)::date END)
      ON CONFLICT (case_id,kind,event) DO NOTHING;
    END LOOP;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION _fin_trg() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN PERFORM _fin_generate(NEW.id); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS fin_gen ON op_cases;
CREATE TRIGGER fin_gen AFTER INSERT OR UPDATE OF status, rule_id, admin_rate, credit, sale_date, returned_at ON op_cases FOR EACH ROW EXECUTE FUNCTION _fin_trg();

CREATE OR REPLACE FUNCTION crm_case_rule(p_org text, p_case text, p_rule text, p_admin_rate numeric) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE me text := _require(p_org,'suporte',3); c op_cases;
BEGIN
  IF p_rule IS NOT NULL AND p_rule<>'' AND NOT EXISTS (SELECT 1 FROM commission_catalog WHERE id=p_rule AND active) THEN RAISE EXCEPTION 'Selecione uma regra de comissão válida'; END IF;
  IF p_admin_rate IS NOT NULL AND (p_admin_rate<=0 OR p_admin_rate>100) THEN RAISE EXCEPTION 'Informe a taxa de administração da Canopus'; END IF;
  UPDATE op_cases SET rule_id=nullif(p_rule,''), admin_rate=p_admin_rate, updated_at=now(),
    history=history||jsonb_build_array(jsonb_build_object('at',now(),'by',me,'what','Regra de comissão: '||coalesce(nullif(p_rule,''),'—')))
  WHERE id=p_case AND organization_id=p_org RETURNING * INTO c;
  IF NOT FOUND THEN RAISE EXCEPTION 'Caso não encontrado'; END IF;
  RETURN to_jsonb(c);
END $$;

CREATE OR REPLACE FUNCTION crm_fin_list(p_org text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE me text := _require(p_org,'contatos',1); office boolean := perm_level(p_org,'suporte')>=3; admin boolean := perm_level(p_org,'equipe')>=3;
BEGIN
  RETURN jsonb_build_object(
   'office',office,'admin',admin,
   'events',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.due_month NULLS LAST, x.client_name, x.seq) FROM (
      SELECT f.id,f.case_id,f.seller_user_id,f.kind,f.event,f.seq,f.rate,f.amount,f.due_month,f.status,f.actual_amount,f.settled_on,f.reference,
             c.client_name,c.product,c.admin AS adm,c.grp,c.quota,c.credit,c.rule_id,c.sale_date,
             coalesce((SELECT i.confirmed FROM fin_installments i WHERE i.case_id=f.case_id AND f.event='Parcela '||i.n),false) AS eligible
      FROM fin_events f JOIN op_cases c ON c.id=f.case_id
      WHERE f.organization_id=p_org AND c.returned_at IS NULL
        AND (office OR (f.kind='VENDEDOR' AND (f.seller_user_id=me OR can_see_owner(p_org,f.seller_user_id))))) x),'[]'::jsonb),
   'installments',coalesce((SELECT jsonb_agg(jsonb_build_object('case_id',i.case_id,'n',i.n,'confirmed',i.confirmed,'confirmed_at',i.confirmed_at)) FROM fin_installments i JOIN op_cases c ON c.id=i.case_id WHERE i.organization_id=p_org AND c.returned_at IS NULL AND (office OR c.seller_user_id=me OR can_see_owner(p_org,c.seller_user_id))),'[]'::jsonb),
   'cases',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'client_name',c.client_name,'seller_user_id',c.seller_user_id,'product',c.product,'adm',c.admin,'grp',c.grp,'quota',c.quota,'credit',c.credit,'status',c.status,'rule_id',c.rule_id,'admin_rate',c.admin_rate,'sale_date',c.sale_date)) FROM op_cases c WHERE c.organization_id=p_org AND c.returned_at IS NULL AND c.status='Efetivado' AND (office OR c.seller_user_id=me OR can_see_owner(p_org,c.seller_user_id))),'[]'::jsonb),
   'catalog',coalesce((SELECT jsonb_agg(jsonb_build_object('id',k.id,'platform',k.platform,'product',k.product,'plan',k.plan,'parcel_type',k.parcel_type,'commission_rate',k.commission_rate,'events',k.events)) FROM commission_catalog k WHERE k.active),'[]'::jsonb),
   'agreements',CASE WHEN admin THEN coalesce((SELECT jsonb_agg(to_jsonb(a)) FROM commission_agreements a WHERE a.organization_id=p_org AND a.active),'[]'::jsonb) ELSE '[]'::jsonb END);
END $$;

CREATE OR REPLACE FUNCTION crm_fin_settle(p_org text, p_id text, p_action text, p_amount numeric, p_date date, p_ref text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE me text := _require(p_org,'suporte',3); f fin_events; c op_cases;
BEGIN
  SELECT * INTO f FROM fin_events WHERE id=p_id AND organization_id=p_org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lançamento não encontrado'; END IF;
  SELECT * INTO c FROM op_cases WHERE id=f.case_id;
  IF p_action='undo' THEN
    UPDATE fin_events SET status='Prevista', actual_amount=NULL, settled_on=NULL, reference=NULL, settled_by=NULL, updated_at=now() WHERE id=p_id RETURNING * INTO f;
    UPDATE op_cases SET history=history||jsonb_build_array(jsonb_build_object('at',now(),'by',me,'what','Baixa desfeita: '||f.kind||' · '||f.event)) WHERE id=f.case_id;
  ELSIF p_action='settle' THEN
    IF f.status<>'Prevista' THEN RAISE EXCEPTION 'Este lançamento já foi baixado'; END IF;
    IF p_amount IS NULL OR p_amount<=0 THEN RAISE EXCEPTION 'Informe um valor positivo'; END IF;
    IF p_date IS NULL OR p_date>(now() AT TIME ZONE 'America/Cuiaba')::date+1 THEN RAISE EXCEPTION 'Informe uma data válida'; END IF;
    IF EXISTS (SELECT 1 FROM fin_events x JOIN op_cases y ON y.id=x.case_id WHERE x.organization_id=p_org AND x.id<>p_id AND x.kind=f.kind AND x.event=f.event AND x.status<>'Prevista'
               AND x.actual_amount=p_amount AND x.settled_on=p_date AND coalesce(x.reference,'')=coalesce(p_ref,'') AND y.admin IS NOT DISTINCT FROM c.admin AND y.grp IS NOT DISTINCT FROM c.grp AND y.quota IS NOT DISTINCT FROM c.quota) THEN
      RAISE EXCEPTION 'Recebimento duplicado: mesma cota, evento, valor, data e referência'; END IF;
    UPDATE fin_events SET status=CASE WHEN kind='ALVO' THEN 'Recebida' ELSE 'Paga' END, actual_amount=p_amount, settled_on=p_date, reference=nullif(trim(p_ref),''), settled_by=me, updated_at=now() WHERE id=p_id RETURNING * INTO f;
    UPDATE op_cases SET history=history||jsonb_build_array(jsonb_build_object('at',now(),'by',me,'what',f.status||': '||f.kind||' · '||f.event||' · R$ '||p_amount)) WHERE id=f.case_id;
  ELSE RAISE EXCEPTION 'Ação inválida'; END IF;
  RETURN to_jsonb(f);
END $$;

CREATE OR REPLACE FUNCTION crm_fin_installment(p_org text, p_case text, p_n int, p_confirm boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE me text := _require(p_org,'suporte',3); r fin_installments;
BEGIN
  IF p_n NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'Mensalidade inválida'; END IF;
  IF NOT EXISTS (SELECT 1 FROM op_cases WHERE id=p_case AND organization_id=p_org AND returned_at IS NULL) THEN RAISE EXCEPTION 'Caso não encontrado'; END IF;
  IF p_confirm AND p_n>1 AND NOT EXISTS (SELECT 1 FROM fin_installments WHERE case_id=p_case AND n=p_n-1 AND confirmed) THEN RAISE EXCEPTION 'Confirme a mensalidade anterior primeiro'; END IF;
  INSERT INTO fin_installments (organization_id,case_id,n,confirmed,confirmed_at,confirmed_by) VALUES (p_org,p_case,p_n,p_confirm,CASE WHEN p_confirm THEN now() END,CASE WHEN p_confirm THEN me END)
  ON CONFLICT (case_id,n) DO UPDATE SET confirmed=p_confirm, confirmed_at=CASE WHEN p_confirm THEN now() END, confirmed_by=CASE WHEN p_confirm THEN me END RETURNING * INTO r;
  RETURN to_jsonb(r);
END $$;

CREATE OR REPLACE FUNCTION crm_fin_agreement_save(p_org text, p_seller text, p_platform text, p_percent numeric, p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE me text := _require(p_org,'equipe',3); a commission_agreements; cid text;
BEGIN
  IF p_percent IS NULL OR p_percent<0 OR p_percent>100 THEN RAISE EXCEPTION 'Percentual individual inválido'; END IF;
  IF NOT EXISTS (SELECT 1 FROM memberships WHERE organization_id=p_org AND user_id=p_seller AND status='ATIVO') THEN RAISE EXCEPTION 'Vendedor inválido'; END IF;
  UPDATE commission_agreements SET active=false WHERE organization_id=p_org AND seller_user_id=p_seller AND lower(platform)=lower(p_platform) AND active;
  INSERT INTO commission_agreements (organization_id,seller_user_id,platform,percent,effective_from,note,created_by) VALUES (p_org,p_seller,p_platform,p_percent,(now() AT TIME ZONE 'America/Cuiaba')::date,nullif(trim(p_note),''),me) RETURNING * INTO a;
  FOR cid IN SELECT o.id FROM op_cases o JOIN commission_catalog k ON k.id=o.rule_id WHERE o.organization_id=p_org AND o.seller_user_id=p_seller AND lower(k.platform)=lower(p_platform) AND o.status='Efetivado' AND o.returned_at IS NULL LOOP
    PERFORM _fin_generate(cid);
  END LOOP;
  RETURN to_jsonb(a);
END $$;

DO $$ DECLARE f text; BEGIN
  FOR f IN SELECT p.oid::regprocedure::text FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND (p.proname LIKE 'crm\_fin%' OR p.proname='crm_case_rule' OR p.proname IN ('_fin_alloc','_fin_generate','_fin_trg')) LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', f); END IF;
    IF f ~ '(^|\.)crm_' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f); ELSE EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', f); END IF;
  END LOOP; END $$;
INSERT INTO commission_catalog (id,platform,product,plan,parcel_type,commission_rate,events,alvo_kind,alvo_events) VALUES
('CAN-8000-R50','Canopus','Automóveis / Bens móveis','Renovação 50','Reduzida',0.02,'[{"event": "Parcela 1", "weight": 0.10416666666666666}, {"event": "Parcela 2", "weight": 0.10416666666666666}, {"event": "Parcela 3", "weight": 0.10416666666666666}, {"event": "Parcela 4", "weight": 0.10416666666666666}, {"event": "Parcela 5", "weight": 0.10416666666666666}, {"event": "Parcela 6", "weight": 0.10416666666666666}, {"event": "Parcela 12", "weight": 0.125}, {"event": "Contemplação", "weight": 0.25}]'::jsonb,'canopus','[{"event": "Parcela 1", "pct": 0.6}, {"event": "Parcela 2", "pct": 0.6}, {"event": "Parcela 3", "pct": 0.6}, {"event": "Parcela 4", "pct": 0.6}, {"event": "Parcela 5", "pct": 0.6}, {"event": "Parcela 6", "pct": 0.6}, {"event": "Parcela 12", "pct": 1}, {"event": "Contemplação", "pct": 1.4}]'::jsonb),
('CAN-GERAL-BM','Canopus','Automóveis / Caminhões / Motos / Solar','Normal / Renovação 70','Reduzida',0.02,'[{"event": "Parcela 1", "weight": 0.15625}, {"event": "Parcela 2", "weight": 0.15625}, {"event": "Parcela 3", "weight": 0.15625}, {"event": "Parcela 4", "weight": 0.15625}, {"event": "Parcela 12", "weight": 0.125}, {"event": "Contemplação", "weight": 0.25}]'::jsonb,'canopus','[{"event": "Parcela 1", "pct": 1}, {"event": "Parcela 2", "pct": 1}, {"event": "Parcela 3", "pct": 1}, {"event": "Parcela 4", "pct": 0.5}, {"event": "Parcela 12", "pct": 1}, {"event": "Contemplação", "pct": 1.5}]'::jsonb),
('CAN-6600-NORMAL-182','Canopus','Imóveis','Normal','Integral',0.02,'[{"event": "Parcela 1", "weight": 0.15625}, {"event": "Parcela 2", "weight": 0.15625}, {"event": "Parcela 3", "weight": 0.15625}, {"event": "Parcela 4", "weight": 0.15625}, {"event": "Parcela 12", "weight": 0.125}, {"event": "Contemplação", "weight": 0.25}]'::jsonb,'canopus','[{"event": "Parcela 1", "pct": 0.6}, {"event": "Parcela 2", "pct": 0.6}, {"event": "Parcela 3", "pct": 0.6}, {"event": "Parcela 4", "pct": 0.6}, {"event": "Parcela 5", "pct": 0.6}, {"event": "Parcela 6", "pct": 0.6}, {"event": "Parcela 12", "pct": 1}, {"event": "Contemplação", "pct": 1.4}]'::jsonb),
('CAN-6600-R50-182','Canopus','Imóveis','Renovação 50','Reduzida',0.02,'[{"event": "Parcela 1", "weight": 0.15625}, {"event": "Parcela 2", "weight": 0.15625}, {"event": "Parcela 3", "weight": 0.15625}, {"event": "Parcela 4", "weight": 0.15625}, {"event": "Parcela 12", "weight": 0.125}, {"event": "Contemplação", "weight": 0.25}]'::jsonb,'canopus','[{"event": "Parcela 1", "pct": 0.4}, {"event": "Parcela 2", "pct": 0.4}, {"event": "Parcela 3", "pct": 0.4}, {"event": "Parcela 4", "pct": 0.4}, {"event": "Parcela 5", "pct": 0.4}, {"event": "Parcela 6", "pct": 0.4}, {"event": "Parcela 7", "pct": 0.4}, {"event": "Parcela 8", "pct": 0.4}, {"event": "Parcela 9", "pct": 0.4}, {"event": "Parcela 12", "pct": 1}, {"event": "Contemplação", "pct": 1.4}]'::jsonb),
('CAN-6620-NORMAL-240','Canopus','Imóveis','Normal','Integral',0.02,'[{"event": "Parcela 1", "weight": 0.15625}, {"event": "Parcela 2", "weight": 0.15625}, {"event": "Parcela 3", "weight": 0.15625}, {"event": "Parcela 4", "weight": 0.15625}, {"event": "Parcela 12", "weight": 0.125}, {"event": "Contemplação", "weight": 0.25}]'::jsonb,'canopus','[{"event": "Parcela 1", "pct": 0.45}, {"event": "Parcela 2", "pct": 0.45}, {"event": "Parcela 3", "pct": 0.45}, {"event": "Parcela 4", "pct": 0.45}, {"event": "Parcela 5", "pct": 0.45}, {"event": "Parcela 6", "pct": 0.45}, {"event": "Parcela 7", "pct": 0.45}, {"event": "Parcela 8", "pct": 0.45}, {"event": "Parcela 9", "pct": 0.45}, {"event": "Parcela 10", "pct": 0.45}, {"event": "Contemplação", "pct": 1.5}]'::jsonb),
('CAN-6620-R50-240','Canopus','Imóveis','Renovação 50','Reduzida',0.02,'[{"event": "Parcela 1", "weight": 0.15625}, {"event": "Parcela 2", "weight": 0.15625}, {"event": "Parcela 3", "weight": 0.15625}, {"event": "Parcela 4", "weight": 0.15625}, {"event": "Parcela 12", "weight": 0.125}, {"event": "Contemplação", "weight": 0.25}]'::jsonb,'canopus','[{"event": "Parcela 1", "pct": 0.25}, {"event": "Parcela 2", "pct": 0.25}, {"event": "Parcela 3", "pct": 0.25}, {"event": "Parcela 4", "pct": 0.25}, {"event": "Parcela 5", "pct": 0.25}, {"event": "Parcela 6", "pct": 0.25}, {"event": "Parcela 7", "pct": 0.25}, {"event": "Parcela 8", "pct": 0.25}, {"event": "Parcela 9", "pct": 0.25}, {"event": "Parcela 10", "pct": 0.25}, {"event": "Parcela 11", "pct": 0.25}, {"event": "Parcela 12", "pct": 0.25}, {"event": "Parcela 13", "pct": 0.25}, {"event": "Parcela 14", "pct": 0.25}, {"event": "Parcela 15", "pct": 0.25}, {"event": "Parcela 16", "pct": 0.25}, {"event": "Parcela 17", "pct": 0.25}, {"event": "Parcela 18", "pct": 0.25}, {"event": "Contemplação", "pct": 1.5}]'::jsonb),
('CAN-6620-R70-182','Canopus','Imóveis','Renovação 70','Reduzida',0.02,'[{"event": "Parcela 1", "weight": 0.08928571428571429}, {"event": "Parcela 2", "weight": 0.08928571428571429}, {"event": "Parcela 3", "weight": 0.08928571428571429}, {"event": "Parcela 4", "weight": 0.08928571428571429}, {"event": "Parcela 5", "weight": 0.08928571428571429}, {"event": "Parcela 6", "weight": 0.08928571428571429}, {"event": "Parcela 7", "weight": 0.08928571428571429}, {"event": "Parcela 12", "weight": 0.125}, {"event": "Contemplação", "weight": 0.25}]'::jsonb,'canopus','[{"event": "Parcela 1", "pct": 0.5}, {"event": "Parcela 2", "pct": 0.5}, {"event": "Parcela 3", "pct": 0.5}, {"event": "Parcela 4", "pct": 0.5}, {"event": "Parcela 5", "pct": 0.5}, {"event": "Parcela 6", "pct": 0.5}, {"event": "Parcela 7", "pct": 0.5}, {"event": "Parcela 12", "pct": 1}, {"event": "Contemplação", "pct": 1.5}]'::jsonb),
('CAN-6620-R70-240','Canopus','Imóveis','Renovação 70','Reduzida',0.02,'[{"event": "Parcela 1", "weight": 0.15625}, {"event": "Parcela 2", "weight": 0.15625}, {"event": "Parcela 3", "weight": 0.15625}, {"event": "Parcela 4", "weight": 0.15625}, {"event": "Parcela 12", "weight": 0.125}, {"event": "Contemplação", "weight": 0.25}]'::jsonb,'canopus','[{"event": "Parcela 1", "pct": 0.25}, {"event": "Parcela 2", "pct": 0.25}, {"event": "Parcela 3", "pct": 0.25}, {"event": "Parcela 4", "pct": 0.25}, {"event": "Parcela 5", "pct": 0.25}, {"event": "Parcela 6", "pct": 0.25}, {"event": "Parcela 7", "pct": 0.25}, {"event": "Parcela 8", "pct": 0.25}, {"event": "Parcela 9", "pct": 0.25}, {"event": "Parcela 10", "pct": 0.25}, {"event": "Parcela 11", "pct": 0.25}, {"event": "Parcela 12", "pct": 0.25}, {"event": "Parcela 13", "pct": 0.25}, {"event": "Parcela 14", "pct": 0.25}, {"event": "Parcela 15", "pct": 0.25}, {"event": "Parcela 16", "pct": 0.25}, {"event": "Parcela 17", "pct": 0.25}, {"event": "Parcela 18", "pct": 0.25}, {"event": "Contemplação", "pct": 1.5}]'::jsonb),
('CAN-IMOV-960-R70','Canopus','Imóveis','Renovação 70','Reduzida',0.02,'[{"event": "Parcela 1", "weight": 0.15625}, {"event": "Parcela 2", "weight": 0.15625}, {"event": "Parcela 3", "weight": 0.15625}, {"event": "Parcela 4", "weight": 0.15625}, {"event": "Parcela 12", "weight": 0.125}, {"event": "Contemplação", "weight": 0.25}]'::jsonb,'canopus','[{"event": "Parcela 1", "pct": 0.7}, {"event": "Parcela 2", "pct": 0.7}, {"event": "Parcela 3", "pct": 0.7}, {"event": "Parcela 4", "pct": 0.7}, {"event": "Parcela 5", "pct": 0.5}, {"event": "Parcela 6", "pct": 0.7}, {"event": "Parcela 7", "pct": 0.7}, {"event": "Contemplação", "pct": 1.3}]'::jsonb),
('CAN-IMOV-GERAL','Canopus','Imóveis','Normal / Renovação 70','Reduzida',0.02,'[{"event": "Parcela 1", "weight": 0.15625}, {"event": "Parcela 2", "weight": 0.15625}, {"event": "Parcela 3", "weight": 0.15625}, {"event": "Parcela 4", "weight": 0.15625}, {"event": "Parcela 12", "weight": 0.125}, {"event": "Contemplação", "weight": 0.25}]'::jsonb,'canopus','[{"event": "Parcela 1", "pct": 1}, {"event": "Parcela 2", "pct": 1}, {"event": "Parcela 3", "pct": 1}, {"event": "Parcela 4", "pct": 0.5}, {"event": "Parcela 12", "pct": 1}, {"event": "Contemplação", "pct": 1.5}]'::jsonb),
('CNP-MEIA-12','CNP','Imóveis / Veículos','Meia parcela','Reduzida',0.015,'[{"event": "Parcela 1", "weight": 0.08333333333333333}, {"event": "Parcela 2", "weight": 0.08333333333333333}, {"event": "Parcela 3", "weight": 0.08333333333333333}, {"event": "Parcela 4", "weight": 0.08333333333333333}, {"event": "Parcela 5", "weight": 0.08333333333333333}, {"event": "Parcela 6", "weight": 0.08333333333333333}, {"event": "Parcela 7", "weight": 0.08333333333333333}, {"event": "Parcela 8", "weight": 0.08333333333333333}, {"event": "Parcela 9", "weight": 0.08333333333333333}, {"event": "Parcela 10", "weight": 0.08333333333333333}, {"event": "Parcela 11", "weight": 0.08333333333333333}, {"event": "Parcela 12", "weight": 0.08333333333333333}]'::jsonb,'fixed','[{"event": "Parcela 1", "pct": 0.33}, {"event": "Parcela 2", "pct": 0.33}, {"event": "Parcela 3", "pct": 0.33}, {"event": "Parcela 4", "pct": 0.33}, {"event": "Parcela 5", "pct": 0.33}, {"event": "Parcela 6", "pct": 0.33}, {"event": "Parcela 7", "pct": 0.33}, {"event": "Parcela 8", "pct": 0.33}, {"event": "Parcela 9", "pct": 0.33}, {"event": "Parcela 10", "pct": 0.33}, {"event": "Parcela 11", "pct": 0.33}, {"event": "Parcela 12", "pct": 0.33}]'::jsonb),
('POR-AUTO-NORMAL','Porto','Automóveis','Normal','Integral',0.012,'[{"event": "Parcela 1", "weight": 0.25}, {"event": "Parcela 2", "weight": 0.25}, {"event": "Parcela 3", "weight": 0.25}, {"event": "Parcela 4", "weight": 0.25}]'::jsonb,NULL,NULL),
('POR-AUTO-RED','Porto','Automóveis','Reduzida','Reduzida',0.012,'[{"event": "Parcela 1", "weight": 0.16666666666666666}, {"event": "Parcela 2", "weight": 0.16666666666666666}, {"event": "Parcela 3", "weight": 0.16666666666666666}, {"event": "Parcela 4", "weight": 0.16666666666666666}, {"event": "Parcela 5", "weight": 0.16666666666666666}, {"event": "Parcela 6", "weight": 0.16666666666666666}]'::jsonb,NULL,NULL),
('POR-PES-NORMAL','Porto','Pesados','Normal','Integral',0.012,'[{"event": "Parcela 1", "weight": 0.16666666666666666}, {"event": "Parcela 2", "weight": 0.16666666666666666}, {"event": "Parcela 3", "weight": 0.16666666666666666}, {"event": "Parcela 4", "weight": 0.16666666666666666}, {"event": "Parcela 5", "weight": 0.16666666666666666}, {"event": "Parcela 6", "weight": 0.16666666666666666}]'::jsonb,NULL,NULL),
('POR-PES-RED','Porto','Pesados','Reduzida','Reduzida',0.012,'[{"event": "Parcela 1", "weight": 0.16666666666666666}, {"event": "Parcela 2", "weight": 0.16666666666666666}, {"event": "Parcela 3", "weight": 0.16666666666666666}, {"event": "Parcela 4", "weight": 0.16666666666666666}, {"event": "Parcela 5", "weight": 0.16666666666666666}, {"event": "Parcela 6", "weight": 0.16666666666666666}]'::jsonb,NULL,NULL),
('POR-IMOV','Porto','Imóveis','Normal','Integral',0.012,'[{"event": "Parcela 1", "weight": 0.08333333333333333}, {"event": "Parcela 2", "weight": 0.08333333333333333}, {"event": "Parcela 3", "weight": 0.08333333333333333}, {"event": "Parcela 4", "weight": 0.08333333333333333}, {"event": "Parcela 5", "weight": 0.08333333333333333}, {"event": "Parcela 6", "weight": 0.08333333333333333}, {"event": "Parcela 7", "weight": 0.08333333333333333}, {"event": "Parcela 8", "weight": 0.08333333333333333}, {"event": "Parcela 9", "weight": 0.08333333333333333}, {"event": "Parcela 10", "weight": 0.08333333333333333}, {"event": "Parcela 11", "weight": 0.08333333333333333}, {"event": "Parcela 12", "weight": 0.08333333333333333}]'::jsonb,'fixed','[{"event": "Parcela 1", "pct": 0.2}, {"event": "Parcela 2", "pct": 0.2}, {"event": "Parcela 3", "pct": 0.2}, {"event": "Parcela 4", "pct": 0.2}, {"event": "Parcela 5", "pct": 0.2}, {"event": "Parcela 6", "pct": 0.2}, {"event": "Parcela 7", "pct": 0.3}, {"event": "Parcela 8", "pct": 0.3}, {"event": "Parcela 9", "pct": 0.3}, {"event": "Parcela 10", "pct": 0.3}, {"event": "Parcela 11", "pct": 0.3}, {"event": "Parcela 12", "pct": 0.3}]'::jsonb),
('SVP-IMOV-NORMAL','Servopa','Imóveis','Normal','Integral',0.012,'[{"event": "Parcela 1", "weight": 0.375}, {"event": "Parcela 3", "weight": 0.125}, {"event": "Parcela 4", "weight": 0.125}, {"event": "Parcela 6", "weight": 0.125}, {"event": "Parcela 9", "weight": 0.125}, {"event": "Parcela 12", "weight": 0.125}]'::jsonb,'fixed','[{"event": "Parcela 1", "pct": 1.5}, {"event": "Parcela 3", "pct": 0.5}, {"event": "Parcela 4", "pct": 0.5}, {"event": "Parcela 6", "pct": 0.5}, {"event": "Parcela 9", "pct": 0.5}, {"event": "Parcela 12", "pct": 0.5}]'::jsonb),
('SVP-IMOV-RED','Servopa','Imóveis','Reduzida','Reduzida',0.012,'[{"event": "Parcela 1", "weight": 0.1875}, {"event": "Parcela 3", "weight": 0.0625}, {"event": "Parcela 4", "weight": 0.0625}, {"event": "Parcela 6", "weight": 0.0625}, {"event": "Parcela 9", "weight": 0.0625}, {"event": "Parcela 12", "weight": 0.0625}, {"event": "Faturamento", "weight": 0.5}]'::jsonb,'fixed','[{"event": "Parcela 1", "pct": 0.75}, {"event": "Parcela 3", "pct": 0.25}, {"event": "Parcela 4", "pct": 0.25}, {"event": "Parcela 6", "pct": 0.25}, {"event": "Parcela 9", "pct": 0.25}, {"event": "Parcela 12", "pct": 0.25}, {"event": "Faturamento", "pct": 2}]'::jsonb),
('SVP-AUTO-NORMAL','Servopa','Automóveis','Normal','Integral',0.012,'[{"event": "Parcela 1", "weight": 0.2857142857142857}, {"event": "Parcela 3", "weight": 0.4285714285714285}, {"event": "Parcela 5", "weight": 0.2857142857142857}]'::jsonb,'fixed','[{"event": "Parcela 1", "pct": 1}, {"event": "Parcela 3", "pct": 1.5}, {"event": "Parcela 5", "pct": 1}]'::jsonb),
('SVP-AUTO-RED','Servopa','Automóveis','Reduzida','Reduzida',0.012,'[{"event": "Parcela 1", "weight": 0.2}, {"event": "Parcela 3", "weight": 0.2}, {"event": "Parcela 5", "weight": 0.1}, {"event": "Faturamento", "weight": 0.5}]'::jsonb,'fixed','[{"event": "Parcela 1", "pct": 0.7}, {"event": "Parcela 3", "pct": 0.7}, {"event": "Parcela 5", "pct": 0.35}, {"event": "Faturamento", "pct": 1.75}]'::jsonb)
ON CONFLICT (id) DO NOTHING;
UPDATE commission_catalog SET alvo_kind='cnp' WHERE id='CNP-MEIA-12';
-- Acordo individual vigente no Floot: Neiva, 2,5% Canopus
INSERT INTO commission_agreements (organization_id,seller_user_id,platform,percent,effective_from,note)
SELECT (SELECT id FROM organizations ORDER BY created_at LIMIT 1),'USR-000006','Canopus',2.5,'2026-01-01','Acordo Neiva 2,5% (1,5% nas parcelas + 0,5% na parcela 12 + 0,5% na contemplação) — migrado do Floot'
WHERE EXISTS (SELECT 1 FROM users WHERE id='USR-000006') AND NOT EXISTS (SELECT 1 FROM commission_agreements WHERE seller_user_id='USR-000006' AND platform='Canopus');
