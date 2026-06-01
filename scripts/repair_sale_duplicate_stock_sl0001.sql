-- Repair duplicate sale stock_movements (Order→Final double-post + Stock sync correction).
-- Scoped to SL-0001; safe to re-run. Edit invoice_no to repair other sales.

\set ON_ERROR_STOP on

DO $$
DECLARE
  v_sale_id UUID;
  v_deleted BIGINT;
BEGIN
  SELECT id INTO v_sale_id
  FROM sales
  WHERE invoice_no = 'SL-0001'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_sale_id IS NULL THEN
    RAISE NOTICE 'No sale found with invoice_no SL-0001 — nothing to repair';
    RETURN;
  END IF;

  RAISE NOTICE 'Repairing stock_movements for sale % (SL-0001)', v_sale_id;

  -- Step 1: Remove positive-qty Stock sync reconciliation rows first
  DELETE FROM stock_movements
  WHERE reference_type = 'sale'
    AND reference_id = v_sale_id
    AND LOWER(TRIM(movement_type)) = 'sale'
    AND quantity > 0
    AND notes LIKE 'Stock sync%';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE '  Stock sync artifacts deleted: %', v_deleted;

  -- Step 2: Dedupe sale OUT rows (keep oldest per product/variation)
  WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY product_id, COALESCE(variation_id, '00000000-0000-0000-0000-000000000000'::uuid)
             ORDER BY created_at ASC
           ) AS rn
    FROM stock_movements
    WHERE reference_type = 'sale'
      AND reference_id = v_sale_id
      AND LOWER(TRIM(movement_type)) = 'sale'
  )
  DELETE FROM stock_movements sm
  USING ranked r
  WHERE sm.id = r.id AND r.rn > 1;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE '  Duplicate sale OUT rows deleted: %', v_deleted;
END $$;

-- Verify remaining movements for SL-0001
SELECT sm.id, sm.created_at, sm.movement_type, sm.quantity, sm.notes
FROM stock_movements sm
JOIN sales s ON s.id = sm.reference_id AND sm.reference_type = 'sale'
WHERE s.invoice_no = 'SL-0001'
ORDER BY sm.created_at;
