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
INSERT INTO studio_production_stages (production_id, stage_type, cost, status)
SELECT p.id, v.stage_type::studio_production_stage_type, 0, 'pending'
FROM studio_productions p
CROSS JOIN (VALUES ('dyer'), ('handwork'), ('stitching')) AS v(stage_type)
WHERE p.sale_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM studio_production_stages s
    WHERE s.production_id = p.id AND s.stage_type = v.stage_type::studio_production_stage_type
  )
ON CONFLICT (production_id, stage_type) DO NOTHING;

-- 2. Backfill: create production + stages for studio sales that still have none
DO $$
DECLARE
  r RECORD;
  v_prod_id UUID;
  v_first_item RECORD;
  v_items_table TEXT := 'sales_items';
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
      ON CONFLICT (company_id, production_no) DO UPDATE SET sale_id = EXCLUDED.sale_id
      RETURNING id INTO v_prod_id;

      IF v_prod_id IS NOT NULL THEN
        INSERT INTO studio_production_stages (production_id, stage_type, cost, status)
        VALUES
          (v_prod_id, 'dyer', 0, 'pending'),
          (v_prod_id, 'handwork', 0, 'pending'),
          (v_prod_id, 'stitching', 0, 'pending')
        ON CONFLICT (production_id, stage_type) DO NOTHING;
      END IF;
    END IF;
  END LOOP;
END $$;
