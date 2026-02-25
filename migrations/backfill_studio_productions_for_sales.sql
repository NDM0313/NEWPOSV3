-- ============================================================================
-- BACKFILL: Create studio_production for Studio Sales that don't have one
-- ============================================================================
-- Fix: STD-0008 and other Studio Sales show on Sales page but not Studio page
-- because studio_production was only created when user opened Studio Sale Detail.
-- This migration creates missing productions for existing Studio Sales.
-- Run in Supabase SQL Editor.
-- ============================================================================

DO $$
DECLARE
  r RECORD;
  v_prod_id UUID;
  v_first_item RECORD;
  v_items_table TEXT;
BEGIN
  -- Detect which items table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sales_items') THEN
    v_items_table := 'sales_items';
  ELSE
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
    -- Get first item (sales_items or sale_items)
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
      ON CONFLICT (company_id, production_no) DO NOTHING
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
