-- ============================================================================
-- PURCHASE + STOCK — FINAL DIAGNOSTIC (Run in Supabase SQL Editor)
-- Run each section and note results. No guessing — use this to fix frontend.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 1 — DATABASE SCHEMA INSPECTION
-- Which columns exist in product_variations and products (stock-related)?
-- ----------------------------------------------------------------------------
SELECT 'STEP 1a: product_variations columns' AS step;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'product_variations'
ORDER BY ordinal_position;

SELECT 'STEP 1b: products stock-related columns' AS step;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'products'
  AND column_name IN ('current_stock', 'stock', 'stock_quantity', 'min_stock', 'max_stock')
ORDER BY ordinal_position;

-- ----------------------------------------------------------------------------
-- STEP 2 — TRACE: Which table is "current_stock" coming from?
-- (Error says "column current_stock does not exist" — products or product_variations?)
-- ----------------------------------------------------------------------------
-- If this fails, the failing table is the one without the column:
-- SELECT id, current_stock FROM product_variations LIMIT 1;
-- SELECT id, current_stock FROM products LIMIT 1;
-- Run them one by one and see which errors.

-- ----------------------------------------------------------------------------
-- STEP 3 — VERIFY STOCK SOURCE
-- Compare movement-based stock vs product_variations.stock (if exists)
-- ----------------------------------------------------------------------------
SELECT 'STEP 3a: movement stock by variation_id (sample)' AS step;
SELECT variation_id, SUM(quantity) AS movement_stock
FROM stock_movements
WHERE variation_id IS NOT NULL
GROUP BY variation_id
LIMIT 20;

SELECT 'STEP 3b: product_variations id, stock (if column exists)' AS step;
-- Run only if STEP 1 shows product_variations has a stock column:
SELECT id, product_id, sku,
       (SELECT SUM(quantity) FROM stock_movements sm WHERE sm.variation_id = pv.id) AS movement_stock
FROM product_variations pv
LIMIT 20;

-- ----------------------------------------------------------------------------
-- STEP 4 — PURCHASE FINALIZE DEBUG
-- Exact enum value and manual update test
-- ----------------------------------------------------------------------------
SELECT 'STEP 4a: purchase_status enum values (exact casing)' AS step;
SELECT unnest(enum_range(NULL::purchase_status)) AS purchase_status_value;

SELECT 'STEP 4b: purchases status column type' AS step;
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name = 'status';

-- Replace with your actual purchase UUID (get from: SELECT id, po_no FROM purchases WHERE po_no = 'PUR-0188';)
SELECT 'STEP 4c: purchase row by po_no (use this id for UPDATE test)' AS step;
SELECT id, po_no, status FROM purchases WHERE po_no = 'PUR-0188' LIMIT 1;

-- Manual update test (run after 4c — use the id from 4c). If this fails, read the error.
-- UPDATE purchases SET status = 'final' WHERE id = '<uuid-from-4c>';
-- Or if enum is uppercase:
-- UPDATE purchases SET status = 'FINAL' WHERE id = '<uuid-from-4c>';

-- ----------------------------------------------------------------------------
-- STEP 5 — TRIGGERS ON purchases
-- ----------------------------------------------------------------------------
SELECT 'STEP 5: triggers on purchases' AS step;
SELECT tgname AS trigger_name, tgrelid::regclass AS table_name
FROM pg_trigger
WHERE tgrelid = 'public.purchases'::regclass
  AND NOT tgisinternal;

-- ----------------------------------------------------------------------------
-- STEP 6 — RLS POLICIES ON purchases
-- ----------------------------------------------------------------------------
SELECT 'STEP 6: RLS policies on purchases' AS step;
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'purchases';

-- ----------------------------------------------------------------------------
-- STEP 7 — QUICK REFERENCE
-- After running, you will know:
-- - product_variations: use column "stock" or only stock_movements (no current_stock).
-- - products: use "current_stock" only if it exists; else use stock_movements.
-- - purchase_status: exact value to send (e.g. 'final' or 'FINAL').
-- Fix frontend to use these; then test Mark as Final again.
-- ============================================================================
