-- Generic custom-order SKUs + business_settings.custom_generic_product_ids
-- Toggle enable_bespoke_orders controls products.is_active via set_company_customization_enabled

SET search_path = public;

ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS custom_generic_product_ids uuid[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.business_settings.custom_generic_product_ids IS
  'Product IDs for CUSTOM-BRIDAL etc.; visibility toggled with enable_bespoke_orders';

-- Seed 4 generic products per company; store IDs on business_settings
CREATE OR REPLACE FUNCTION public.seed_bespoke_generic_products(p_company_id uuid)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unit_id uuid;
  v_ids uuid[] := '{}';
  v_pid uuid;
  rec RECORD;
BEGIN
  IF p_company_id IS NULL THEN
    RETURN v_ids;
  END IF;

  SELECT u.id INTO v_unit_id
  FROM public.units u
  WHERE u.company_id = p_company_id
  ORDER BY CASE WHEN lower(COALESCE(u.short_code, u.symbol, u.name, '')) IN ('pcs', 'pc', 'piece') THEN 0 ELSE 1 END,
           u.created_at NULLS LAST
  LIMIT 1;

  IF v_unit_id IS NULL THEN
    SELECT u.id INTO v_unit_id FROM public.units u ORDER BY u.created_at NULLS LAST LIMIT 1;
  END IF;

  FOR rec IN
    SELECT * FROM (VALUES
      ('CUSTOM-BRIDAL',     'Custom Order — Bridal'),
      ('CUSTOM-PARTYWEAR',  'Custom Order — Party Wear'),
      ('CUSTOM-FORMAL',     'Custom Order — Formal'),
      ('CUSTOM-CASUAL',     'Custom Order — Casual')
    ) AS t(sku, pname)
  LOOP
    SELECT p.id INTO v_pid
    FROM public.products p
    WHERE p.company_id = p_company_id AND trim(p.sku) = rec.sku
    LIMIT 1;

    IF v_pid IS NULL THEN
      INSERT INTO public.products (
        company_id, name, sku, unit_id,
        cost_price, retail_price, wholesale_price,
        has_variations, is_rentable, is_sellable, track_stock, is_active,
        product_type, source_type
      ) VALUES (
        p_company_id, rec.pname, rec.sku, v_unit_id,
        0, 0, 0,
        false, false, true, false, false,
        'normal', 'manual'
      )
      RETURNING id INTO v_pid;
    END IF;

    IF v_pid IS NOT NULL THEN
      v_ids := array_append(v_ids, v_pid);
    END IF;
  END LOOP;

  UPDATE public.business_settings
     SET custom_generic_product_ids = v_ids,
         updated_at = now()
   WHERE company_id = p_company_id;

  RETURN v_ids;
END;
$$;

-- Backfill all companies
DO $$
DECLARE
  cid uuid;
BEGIN
  FOR cid IN SELECT id FROM public.companies
  LOOP
    INSERT INTO public.business_settings (company_id, enable_bespoke_orders, bespoke_form_config)
    VALUES (
      cid, false,
      '{"show_measurements":true,"show_fabric":true,"show_color_code":true,"show_image_upload":true,"show_delivery_date":true,"show_customization_charges":false}'::jsonb
    )
    ON CONFLICT (company_id) DO NOTHING;
    PERFORM public.seed_bespoke_generic_products(cid);
  END LOOP;
END $$;

-- Extend company seed trigger
CREATE OR REPLACE FUNCTION public.seed_business_settings_for_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'business_settings'
  ) THEN
    INSERT INTO public.business_settings (company_id, enable_bespoke_orders, bespoke_form_config)
    VALUES (
      NEW.id,
      false,
      '{
        "show_measurements": true,
        "show_fabric": true,
        "show_color_code": true,
        "show_image_upload": true,
        "show_delivery_date": true,
        "show_customization_charges": false
      }'::jsonb
    )
    ON CONFLICT (company_id) DO NOTHING;
    PERFORM public.seed_bespoke_generic_products(NEW.id);
  END IF;
  RETURN NEW;
END;
$fn$;

-- Atomic toggle: settings + generic product visibility
CREATE OR REPLACE FUNCTION public.set_company_customization_enabled(
  p_company_id uuid,
  p_enabled boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids uuid[];
BEGIN
  IF p_company_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'company_id required');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.company_id = p_company_id
      AND (u.id = auth.uid() OR u.auth_user_id = auth.uid())
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
  END IF;

  v_ids := public.seed_bespoke_generic_products(p_company_id);

  UPDATE public.business_settings
     SET enable_bespoke_orders = COALESCE(p_enabled, false),
         updated_at = now()
   WHERE company_id = p_company_id;

  IF v_ids IS NOT NULL AND cardinality(v_ids) > 0 THEN
    UPDATE public.products
       SET is_active = COALESCE(p_enabled, false),
           updated_at = now()
     WHERE id = ANY(v_ids)
       AND company_id = p_company_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'enabled', COALESCE(p_enabled, false),
    'product_ids', to_jsonb(COALESCE(v_ids, '{}'::uuid[]))
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_bespoke_generic_products(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_company_customization_enabled(uuid, boolean) TO authenticated;
