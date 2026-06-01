-- One-shot repair: clear stale inventory_balance (and optional orphan bespoke WOs)
-- after a company transaction reset that ran before migration 20260602170000.
--
-- Single company: edit v_company_id below.
-- All companies: set v_all_companies := TRUE (review NOTICE output first).
-- Runs in Supabase SQL editor / any client (no psql meta-commands).

DO $$
DECLARE
  -- Set one company UUID here, or set v_all_companies := TRUE for every company (review first).
  v_company_id UUID := '597a5292-14c8-4cd8-96bd-c61b5a0d8c92'::uuid;
  v_all_companies BOOLEAN := FALSE;
  v_rows BIGINT;
  v_cid UUID;
BEGIN
  IF NOT v_all_companies AND v_company_id IS NULL THEN
    RAISE EXCEPTION 'Set v_company_id in the DO block or v_all_companies := TRUE';
  END IF;

  FOR v_cid IN
    SELECT c.id
    FROM companies c
    WHERE (v_all_companies OR c.id = v_company_id)
  LOOP
    RAISE NOTICE 'Repair company %', v_cid;

    IF to_regclass('public.inventory_balance') IS NOT NULL THEN
      DELETE FROM inventory_balance WHERE company_id = v_cid;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE NOTICE '  inventory_balance deleted: %', v_rows;
    END IF;

    IF to_regclass('public.product_branches') IS NOT NULL THEN
      DELETE FROM product_branches WHERE company_id = v_cid;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE NOTICE '  product_branches deleted: %', v_rows;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'current_stock'
    ) THEN
      UPDATE products SET current_stock = 0 WHERE company_id = v_cid;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE NOTICE '  products.current_stock zeroed: %', v_rows;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'product_variations' AND column_name = 'current_stock'
    ) THEN
      UPDATE product_variations pv
         SET current_stock = 0
        FROM products p
       WHERE pv.product_id = p.id
         AND p.company_id = v_cid;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE NOTICE '  product_variations.current_stock zeroed: %', v_rows;
    END IF;

    IF to_regclass('public.bespoke_work_orders') IS NOT NULL THEN
      DELETE FROM bespoke_work_orders bwo
      WHERE bwo.company_id = v_cid
        AND bwo.sale_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM sales s WHERE s.id = bwo.sale_id);
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE NOTICE '  orphan bespoke_work_orders deleted: %', v_rows;
    END IF;
  END LOOP;
END $$;

-- Verify (run after DO block; edit company UUID if needed)
SELECT COUNT(*) AS inventory_balance_rows
FROM inventory_balance
WHERE company_id = '597a5292-14c8-4cd8-96bd-c61b5a0d8c92'::uuid;

SELECT p.sku, ib.qty, ib.branch_id
FROM inventory_balance ib
JOIN products p ON p.id = ib.product_id
WHERE ib.company_id = '597a5292-14c8-4cd8-96bd-c61b5a0d8c92'::uuid
  AND (p.sku ILIKE '%CUSTOM%' OR p.name ILIKE '%CUSTOM%')
ORDER BY p.sku
LIMIT 20;
