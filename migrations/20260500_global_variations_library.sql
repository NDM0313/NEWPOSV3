-- Migration: 20260500_global_variations_library.sql
-- Purpose : Introduce a company-level variation attribute library so attributes
--           like Color and Size are defined once per company and reused across
--           products. Keeps the existing product_variations.attributes JSONB
--           column in sync for backward compatibility.
-- Safe to re-run (idempotent): all DDL uses IF NOT EXISTS / ON CONFLICT DO NOTHING.

BEGIN;

-- 1. Attribute tables ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.variation_attributes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name       text NOT NULL,
  sort_order int  NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT variation_attributes_name_chk CHECK (char_length(trim(name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS variation_attributes_company_name_uniq
  ON public.variation_attributes (company_id, lower(name));

CREATE INDEX IF NOT EXISTS variation_attributes_company_idx
  ON public.variation_attributes (company_id);

CREATE TABLE IF NOT EXISTS public.variation_attribute_values (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attribute_id uuid NOT NULL REFERENCES public.variation_attributes(id) ON DELETE CASCADE,
  value        text NOT NULL,
  hex_color    text NULL,
  sort_order   int  NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT variation_attribute_values_value_chk CHECK (char_length(trim(value)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS variation_attribute_values_attr_value_uniq
  ON public.variation_attribute_values (attribute_id, lower(value));

CREATE INDEX IF NOT EXISTS variation_attribute_values_attr_idx
  ON public.variation_attribute_values (attribute_id);

-- 2. Mapping table product_variations <-> library values ----------------------

CREATE TABLE IF NOT EXISTS public.product_variation_value_map (
  variation_id uuid NOT NULL REFERENCES public.product_variations(id) ON DELETE CASCADE,
  value_id     uuid NOT NULL REFERENCES public.variation_attribute_values(id) ON DELETE CASCADE,
  PRIMARY KEY (variation_id, value_id)
);

CREATE INDEX IF NOT EXISTS product_variation_value_map_value_idx
  ON public.product_variation_value_map (value_id);

-- 3. Backfill from existing product_variations.attributes JSON ----------------

DO $$
DECLARE
  v_row record;
  v_attr record;
  v_company_id uuid;
  v_attr_id uuid;
  v_value_id uuid;
BEGIN
  FOR v_row IN
    SELECT pv.id AS variation_id, pv.attributes, p.company_id
    FROM public.product_variations pv
    JOIN public.products p ON p.id = pv.product_id
    WHERE pv.attributes IS NOT NULL
      AND jsonb_typeof(pv.attributes) = 'object'
  LOOP
    v_company_id := v_row.company_id;
    FOR v_attr IN
      SELECT key AS attr_name,
             CASE jsonb_typeof(value) WHEN 'string' THEN value #>> '{}' ELSE value::text END AS attr_value
      FROM jsonb_each(v_row.attributes)
    LOOP
      IF v_attr.attr_name IS NULL OR length(trim(v_attr.attr_name)) = 0 THEN CONTINUE; END IF;
      IF v_attr.attr_value IS NULL OR length(trim(v_attr.attr_value)) = 0 THEN CONTINUE; END IF;

      INSERT INTO public.variation_attributes (company_id, name)
      VALUES (v_company_id, trim(v_attr.attr_name))
      ON CONFLICT (company_id, lower(name)) DO NOTHING;

      SELECT id INTO v_attr_id
      FROM public.variation_attributes
      WHERE company_id = v_company_id AND lower(name) = lower(trim(v_attr.attr_name));

      IF v_attr_id IS NULL THEN CONTINUE; END IF;

      INSERT INTO public.variation_attribute_values (attribute_id, value)
      VALUES (v_attr_id, trim(v_attr.attr_value))
      ON CONFLICT (attribute_id, lower(value)) DO NOTHING;

      SELECT id INTO v_value_id
      FROM public.variation_attribute_values
      WHERE attribute_id = v_attr_id AND lower(value) = lower(trim(v_attr.attr_value));

      IF v_value_id IS NULL THEN CONTINUE; END IF;

      INSERT INTO public.product_variation_value_map (variation_id, value_id)
      VALUES (v_row.variation_id, v_value_id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END$$;

-- 4. Keep attributes JSON in sync: trigger rebuilds JSON whenever the map changes.

CREATE OR REPLACE FUNCTION public._sync_product_variation_attributes_json()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_variation_id uuid;
  v_json jsonb;
BEGIN
  v_variation_id := COALESCE(NEW.variation_id, OLD.variation_id);

  SELECT COALESCE(jsonb_object_agg(va.name, vav.value), '{}'::jsonb)
  INTO v_json
  FROM public.product_variation_value_map m
  JOIN public.variation_attribute_values vav ON vav.id = m.value_id
  JOIN public.variation_attributes va ON va.id = vav.attribute_id
  WHERE m.variation_id = v_variation_id;

  UPDATE public.product_variations
  SET attributes = v_json,
      updated_at = now()
  WHERE id = v_variation_id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_variation_attrs_ins ON public.product_variation_value_map;
CREATE TRIGGER trg_sync_variation_attrs_ins
  AFTER INSERT ON public.product_variation_value_map
  FOR EACH ROW EXECUTE FUNCTION public._sync_product_variation_attributes_json();

DROP TRIGGER IF EXISTS trg_sync_variation_attrs_del ON public.product_variation_value_map;
CREATE TRIGGER trg_sync_variation_attrs_del
  AFTER DELETE ON public.product_variation_value_map
  FOR EACH ROW EXECUTE FUNCTION public._sync_product_variation_attributes_json();

-- 5. Row level security -------------------------------------------------------

ALTER TABLE public.variation_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variation_attribute_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variation_value_map ENABLE ROW LEVEL SECURITY;

-- variation_attributes: members of the company can select/modify.
DROP POLICY IF EXISTS variation_attributes_company_access ON public.variation_attributes;
CREATE POLICY variation_attributes_company_access
  ON public.variation_attributes
  FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT u.company_id FROM public.users u WHERE u.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT u.company_id FROM public.users u WHERE u.auth_user_id = auth.uid()
    )
  );

-- variation_attribute_values: inherit access via parent attribute.
DROP POLICY IF EXISTS variation_attribute_values_company_access ON public.variation_attribute_values;
CREATE POLICY variation_attribute_values_company_access
  ON public.variation_attribute_values
  FOR ALL
  TO authenticated
  USING (
    attribute_id IN (
      SELECT va.id FROM public.variation_attributes va
      WHERE va.company_id IN (
        SELECT u.company_id FROM public.users u WHERE u.auth_user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    attribute_id IN (
      SELECT va.id FROM public.variation_attributes va
      WHERE va.company_id IN (
        SELECT u.company_id FROM public.users u WHERE u.auth_user_id = auth.uid()
      )
    )
  );

-- product_variation_value_map: inherit access via variation->product->company.
DROP POLICY IF EXISTS product_variation_value_map_company_access ON public.product_variation_value_map;
CREATE POLICY product_variation_value_map_company_access
  ON public.product_variation_value_map
  FOR ALL
  TO authenticated
  USING (
    variation_id IN (
      SELECT pv.id FROM public.product_variations pv
      JOIN public.products p ON p.id = pv.product_id
      WHERE p.company_id IN (
        SELECT u.company_id FROM public.users u WHERE u.auth_user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    variation_id IN (
      SELECT pv.id FROM public.product_variations pv
      JOIN public.products p ON p.id = pv.product_id
      WHERE p.company_id IN (
        SELECT u.company_id FROM public.users u WHERE u.auth_user_id = auth.uid()
      )
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.variation_attributes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.variation_attribute_values TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variation_value_map TO authenticated;

COMMIT;
