-- ============================================================================
-- LINK STUDIO PRODUCTIONS TO SALES (fix "No stage details yet")
-- ============================================================================
-- 1. Fix productions that have no sale_id: set sale_id where production_no matches a sale (PRD-STD-xxx).
-- 2. For studio sales that still have no production, create production + 3 stages (dyer, stitching, handwork).
-- Run in Supabase SQL Editor. Safe to run multiple times.
-- ============================================================================

-- 1. Link existing productions to sales by matching production_no to 'PRD-' || invoice_no
UPDATE studio_productions p
SET sale_id = s.id
FROM sales s
WHERE p.sale_id IS NULL
  AND (s.is_studio = true OR s.invoice_no ILIKE 'STD-%')
  AND s.status != 'cancelled'
  AND p.production_no = 'PRD-' || COALESCE(s.invoice_no, '');

-- 1b. Ensure every linked production has the three stages (fixes productions that had no stages before link)
DO $$
DECLARE
  pr RECORD;
  st TEXT;
  nxt INT;
  has_stage_order BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='studio_production_stages' AND column_name='stage_order') INTO has_stage_order;
  FOR pr IN SELECT id FROM studio_productions WHERE sale_id IS NOT NULL
  LOOP
    nxt := 1;
    FOR st IN SELECT unnest(ARRAY['dyer', 'handwork', 'stitching'])
    LOOP
      IF NOT EXISTS (SELECT 1 FROM studio_production_stages s WHERE s.production_id = pr.id AND s.stage_type::text = st) THEN
        IF has_stage_order THEN
          SELECT COALESCE(MAX(stage_order), 0) + 1 INTO nxt FROM studio_production_stages WHERE production_id = pr.id;
          IF nxt IS NULL THEN nxt := 1; END IF;
          INSERT INTO studio_production_stages (production_id, stage_type, cost, status, stage_order)
          VALUES (pr.id, st::studio_production_stage_type, 0, 'pending', nxt);
        ELSE
          INSERT INTO studio_production_stages (production_id, stage_type, cost, status)
          VALUES (pr.id, st::studio_production_stage_type, 0, 'pending');
        END IF;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- 2. Backfill: create production + stages for studio sales that still have none
DO $$
DECLARE
  r RECORD;
  v_prod_id UUID;
  v_first_item RECORD;
  v_items_table TEXT := 'sales_items';
  v_stage TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sales_items') THEN
    v_items_table := 'sale_items';
  END IF;

  FOR r IN (
    SELECT s.id, s.company_id, s.branch_id, s.invoice_no, s.invoice_date, s.created_by
    FROM sales s
    WHERE (s.is_studio = true OR s.invoice_no ILIKE 'STD-%')
      AND NOT EXISTS (SELECT 1 FROM studio_productions sp WHERE sp.sale_id = s.id)
      AND s.status != 'cancelled'
  )
  LOOP
    EXECUTE format(
      'SELECT product_id, quantity, unit, variation_id FROM %I WHERE sale_id = $1 ORDER BY id LIMIT 1',
      v_items_table
    ) INTO v_first_item USING r.id;

    IF v_first_item.product_id IS NOT NULL THEN
      SELECT id INTO v_prod_id FROM studio_productions sp
      WHERE sp.company_id = r.company_id AND sp.production_no = 'PRD-' || COALESCE(r.invoice_no, r.id::text)
      LIMIT 1;
      IF v_prod_id IS NULL THEN
        INSERT INTO studio_productions (
          company_id, branch_id, sale_id, production_no, production_date,
          product_id, variation_id, quantity, unit, status, created_by
        )
        VALUES (
          r.company_id, r.branch_id, r.id,
          'PRD-' || COALESCE(r.invoice_no, r.id::text),
          COALESCE(r.invoice_date::date, CURRENT_DATE),
          v_first_item.product_id,
          v_first_item.variation_id,
          GREATEST(COALESCE(v_first_item.quantity, 1), 0.01),
          COALESCE(NULLIF(TRIM(v_first_item.unit), ''), 'piece'),
          'draft',
          r.created_by
        )
        RETURNING id INTO v_prod_id;
      ELSE
        UPDATE studio_productions SET sale_id = r.id WHERE id = v_prod_id;
      END IF;

      IF v_prod_id IS NOT NULL THEN
        FOR v_stage IN SELECT unnest(ARRAY['dyer', 'handwork', 'stitching']::text[])
        LOOP
          IF NOT EXISTS (SELECT 1 FROM studio_production_stages s WHERE s.production_id = v_prod_id AND s.stage_type::text = v_stage) THEN
            INSERT INTO studio_production_stages (production_id, stage_type, cost, status)
            VALUES (v_prod_id, v_stage::studio_production_stage_type, 0, 'pending');
          END IF;
        END LOOP;
      END IF;
    END IF;
  END LOOP;
END $$;
