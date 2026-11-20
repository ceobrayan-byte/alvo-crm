-- 21: Geladeira (= Contatos) e Leads Frios iguais ao Floot
-- Geladeira: leads na etapa Geladeira (compartilhados). Cada contato guarda em source_data->'fridge':
--   interest (low|medium|high), contacted_by, contacted_at, note, due (retorno agendado).
-- Leads Frios: cold_leads (enviados da Geladeira) + base importada cold_contacts (103 mil do Floot), paginada no banco.
CREATE INDEX IF NOT EXISTS cold_contacts_status_name ON cold_contacts (status, name_key);
CREATE INDEX IF NOT EXISTS cold_contacts_phone ON cold_contacts (phone);

CREATE OR REPLACE FUNCTION crm_fridge_update(p_org text, p_id text, p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE me text := _require(p_org,'contatos',2); who text; row_ leads; f jsonb; a text := p_data->>'action';
BEGIN
  SELECT display_name INTO who FROM users WHERE id=me;
  SELECT * INTO row_ FROM leads WHERE id=p_id AND organization_id=p_org AND stage='Geladeira' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contato não está na Geladeira'; END IF;
  f := coalesce(row_.source_data->'fridge','{}'::jsonb);
  IF a='contact' THEN f := f||jsonb_build_object('contacted_by',who,'contacted_at',now());
  ELSIF a='interest' THEN
    IF p_data->>'interest' NOT IN ('low','medium','high') THEN RAISE EXCEPTION 'Interesse inválido'; END IF;
    f := f||jsonb_build_object('interest',p_data->>'interest');
  ELSIF a='note' THEN
    f := f||jsonb_build_object('note',nullif(left(trim(coalesce(p_data->>'note','')),800),''),'due',nullif(p_data->>'due',''),'note_by',who,'note_at',now());
  ELSE RAISE EXCEPTION 'Ação inválida'; END IF;
  UPDATE leads SET source_data=coalesce(source_data,'{}'::jsonb)||jsonb_build_object('fridge',f), updated_at=now() WHERE id=p_id RETURNING * INTO row_;
  RETURN to_jsonb(row_);
END $$;

CREATE OR REPLACE FUNCTION crm_cold_page(p_org text, p_q text, p_origin text, p_offset int) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE me text := _require(p_org,'contatos',1); q text := lower(coalesce(trim(p_q),'')); ph text := regexp_replace(coalesce(p_q,''),'\D','','g'); res jsonb;
BEGIN
  WITH base AS (
    SELECT c.id, c.name, c.phone, c.email, c.origin, c.reason, c.return_owner AS owner, c.last_interaction, c.entered_at, 'frio'::text AS kind
      FROM cold_leads c WHERE c.organization_id=p_org
    UNION ALL
    SELECT k.id, k.name, k.phone, k.email, k.origin, NULL, NULL, NULL, k.created_at, 'base'
      FROM cold_contacts k WHERE k.status='COLD'
  ), f AS (
    SELECT * FROM base WHERE (q='' OR lower(name) LIKE '%'||q||'%' OR (ph<>'' AND phone LIKE '%'||ph||'%'))
      AND (coalesce(p_origin,'')='' OR origin=p_origin)
  )
  SELECT jsonb_build_object('total',(SELECT count(*) FROM f),
    'origins',(SELECT jsonb_agg(o ORDER BY o) FROM (SELECT DISTINCT origin o FROM base WHERE origin IS NOT NULL) x),
    'rows',coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM (SELECT * FROM f ORDER BY (kind='frio') DESC, entered_at DESC NULLS LAST, name OFFSET greatest(0,coalesce(p_offset,0)) LIMIT 20) p),'[]'::jsonb)) INTO res;
  RETURN res;
END $$;

-- puxar um contato da base fria para o Kanban do usuário (Closer)
CREATE OR REPLACE FUNCTION crm_cold_take(p_org text, p_id text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE me text := _require(p_org,'contatos',2); k cold_contacts; row_ leads;
BEGIN
  IF EXISTS (SELECT 1 FROM cold_leads WHERE id=p_id AND organization_id=p_org) THEN RETURN crm_cold_resume(p_org,p_id); END IF;
  SELECT * INTO k FROM cold_contacts WHERE id=p_id AND status='COLD' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contato já foi puxado por outra pessoa'; END IF;
  INSERT INTO leads (organization_id,owner_user_id,name,phone,email,origin,stage,last_contact,source_data)
  VALUES (p_org,me,k.name,k.phone,k.email,k.origin,'Closer','Lead retomado da base fria.',jsonb_build_object('cold_contact_id',k.id)) RETURNING * INTO row_;
  UPDATE cold_contacts SET status='CLAIMED', claimed_lead_id=row_.id WHERE id=k.id;
  RETURN to_jsonb(row_);
END $$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY array['crm_fridge_update(text,text,jsonb)','crm_cold_page(text,text,text,integer)','crm_cold_take(text,text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP; END $$;
