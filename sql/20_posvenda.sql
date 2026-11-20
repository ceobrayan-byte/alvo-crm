-- 20: Negócios = painel de pós-venda (acompanhamento das cotas vendidas até a contemplação e a liberação do crédito)
-- Só cotas com venda registrada (Efetivado + regra + data). Escopo: dono/admin/suporte tudo; coordenador a equipe; vendedor as próprias.
-- Edição: quem tem Suporte nível 3 (proprietário, administrador e suporte). Os demais só visualizam.
ALTER TABLE op_cases ADD COLUMN IF NOT EXISTS postsale jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION crm_postsale_list(p_org text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE me text := _require(p_org,'funis',1);
BEGIN
  RETURN jsonb_build_object('can_edit', perm_level(p_org,'suporte')>=3,
   'items', coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'client',c.client_name,'seller',c.seller_user_id,'adm',c.admin,'product',c.product,'grp',c.grp,'quota',c.quota,
      'credit',c.credit,'term',c.term,'date',c.sale_date,'first_payment',c.first_payment,'phone',c.phone,'email',c.email,'ps',c.postsale) ORDER BY c.sale_date DESC, c.id DESC)
     FROM op_cases c WHERE c.organization_id=p_org AND c.status='Efetivado' AND c.rule_id IS NOT NULL AND c.sale_date IS NOT NULL AND c.returned_at IS NULL
       AND (c.seller_user_id=me OR can_see_owner(p_org,c.seller_user_id))),'[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION crm_postsale_save(p_org text, p_id text, p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE me text := _require(p_org,'suporte',3); st text := p_data->>'stage'; prev jsonb; nxt jsonb; who text;
BEGIN
  IF st NOT IN ('aguardando','contemplada','analise','liberado','cancelada') THEN RAISE EXCEPTION 'Situação inválida'; END IF;
  IF coalesce(p_data->>'mode','') NOT IN ('','Sorteio','Lance livre','Lance fixo','Lance embutido') THEN RAISE EXCEPTION 'Forma de contemplação inválida'; END IF;
  IF st IN ('contemplada','analise','liberado') AND coalesce(p_data->>'contemplated_on','')='' THEN RAISE EXCEPTION 'Informe a data da contemplação'; END IF;
  IF (p_data->>'bid_pct') IS NOT NULL AND (nullif(p_data->>'bid_pct','')::numeric<0 OR nullif(p_data->>'bid_pct','')::numeric>100) THEN RAISE EXCEPTION 'Percentual de lance inválido'; END IF;
  SELECT display_name INTO who FROM users WHERE id=me;
  SELECT postsale INTO prev FROM op_cases WHERE id=p_id AND organization_id=p_org AND status='Efetivado';
  IF NOT FOUND THEN RAISE EXCEPTION 'Cota não encontrada'; END IF;
  nxt := jsonb_build_object('stage',st,'contemplated_on',nullif(p_data->>'contemplated_on',''),'mode',nullif(p_data->>'mode',''),
    'bid_pct',nullif(p_data->>'bid_pct','')::numeric,'released_on',nullif(p_data->>'released_on',''),'note',nullif(left(trim(coalesce(p_data->>'note','')),600),''),
    'updated_by',who,'updated_at',now(),
    'log',coalesce(prev->'log','[]'::jsonb)||jsonb_build_array(jsonb_build_object('at',now(),'by',who,'from',coalesce(prev->>'stage','aguardando'),'to',st)));
  UPDATE op_cases SET postsale=nxt, updated_at=now() WHERE id=p_id;
  RETURN nxt;
END $$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY array['crm_postsale_list(text)','crm_postsale_save(text,text,jsonb)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP; END $$;
