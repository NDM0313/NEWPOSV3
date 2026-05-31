-- Bespoke / custom orders: business_settings table + sales line customization_details JSONB

-- ---------------------------------------------------------------------------
-- business_settings (one row per company)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.business_settings (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  enable_bespoke_orders boolean NOT NULL DEFAULT false,
  bespoke_form_config jsonb NOT NULL DEFAULT '{
    "show_measurements": true,
    "show_fabric": true,
    "show_color_code": true,
    "show_image_upload": true,
    "show_delivery_date": true,
    "show_customization_charges": true
  }'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.business_settings IS 'Company-level bespoke/custom order feature toggle and form field visibility';
COMMENT ON COLUMN public.business_settings.enable_bespoke_orders IS 'When true, POS and sales show per-line Customize / Add Details';
COMMENT ON COLUMN public.business_settings.bespoke_form_config IS 'JSON flags for which bespoke fields appear in the modal';

-- Backfill existing companies
INSERT INTO public.business_settings (company_id, enable_bespoke_orders, bespoke_form_config)
SELECT c.id, false, '{
  "show_measurements": true,
  "show_fabric": true,
  "show_color_code": true,
  "show_image_upload": true,
  "show_delivery_date": true,
  "show_customization_charges": true
}'::jsonb
FROM public.companies c
ON CONFLICT (company_id) DO NOTHING;

-- Auto-seed on new company
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
        "show_customization_charges": true
      }'::jsonb
    )
    ON CONFLICT (company_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_seed_business_settings ON public.companies;
CREATE TRIGGER trg_seed_business_settings
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_business_settings_for_company();

-- RLS
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_settings_select ON public.business_settings;
CREATE POLICY business_settings_select
  ON public.business_settings FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

DROP POLICY IF EXISTS business_settings_insert ON public.business_settings;
CREATE POLICY business_settings_insert
  ON public.business_settings FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_user_company_id()
    AND is_admin_or_owner()
  );

DROP POLICY IF EXISTS business_settings_update ON public.business_settings;
CREATE POLICY business_settings_update
  ON public.business_settings FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id() AND is_admin_or_owner())
  WITH CHECK (company_id = get_user_company_id() AND is_admin_or_owner());

GRANT SELECT, INSERT, UPDATE ON public.business_settings TO authenticated;

-- ---------------------------------------------------------------------------
-- customization_details on sale line tables
-- ---------------------------------------------------------------------------
DO $col$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'sales_items'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sales_items' AND column_name = 'customization_details'
  ) THEN
    ALTER TABLE public.sales_items ADD COLUMN customization_details jsonb;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'sale_items'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sale_items' AND column_name = 'customization_details'
  ) THEN
    ALTER TABLE public.sale_items ADD COLUMN customization_details jsonb;
  END IF;
END $col$;

COMMENT ON COLUMN public.sales_items.customization_details IS 'Bespoke/custom order details per line (fabric, measurements, delivery, charges, image refs)';
COMMENT ON COLUMN public.sale_items.customization_details IS 'Bespoke/custom order details per line (legacy sale_items table)';
