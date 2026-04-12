-- =====================================================================
-- sale_items DATA MIGRATION → sales_items
-- Purpose : Copy all historical rows from legacy sale_items into the
--           canonical sales_items table.
-- Safe    : Non-destructive. sale_items is NOT dropped.
--           Wraps in a transaction — rolls back on any error.
-- Pre-req : Run verify scripts first (below). Confirm 0 errors.
-- Context : 38_SALE_ITEMS_MIGRATION_AND_READ_RETIREMENT
-- =====================================================================

-- ─── PRE-MIGRATION: Verify read safety ────────────────────────────────────────
-- Run these checks FIRST. Do NOT proceed if any check shows unexpected data.

-- Check A: How many sale_ids exist only in sale_items (not yet in sales_items)?
SELECT COUNT(DISTINCT sale_id) AS legacy_only_sales
FROM sale_items
WHERE NOT EXISTS (
  SELECT 1 FROM sales_items sis WHERE sis.sale_id = sale_items.sale_id
);

-- Check B: Total rows to migrate
SELECT COUNT(*) AS rows_to_migrate FROM sale_items
WHERE NOT EXISTS (
  SELECT 1 FROM sales_items sis WHERE sis.sale_id = sale_items.sale_id
);

-- Check C: Any sale_items.id that already exists in sales_items.id?
-- Must be 0 — if > 0, we cannot use explicit UUID copy
SELECT COUNT(*) AS id_collisions
FROM sale_items si
JOIN sales_items sis ON sis.id = si.id;

-- ─── MIGRATION ────────────────────────────────────────────────────────────────
-- IMPORTANT: Review Check A, B, C above. Only proceed if id_collisions = 0.
-- Comment out lines 38-65 and run them only after reviewing the checks above.

BEGIN;

-- Step 1: Count pre-migration
DO $$
DECLARE
  v_sale_items_count   INTEGER;
  v_sales_items_count  INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_sale_items_count FROM sale_items;
  SELECT COUNT(*) INTO v_sales_items_count FROM sales_items;
  RAISE NOTICE 'PRE-MIGRATION: sale_items=%, sales_items=%', v_sale_items_count, v_sales_items_count;
END $$;

-- Step 2: Insert rows from sale_items that have no match in sales_items (by sale_id)
-- Preserves id for FK compatibility (sale_return_items.sale_item_id references sale_items.id)
-- P2 patch: company_id derived from parent sales table if missing in sale_items (some legacy rows lack it)
-- P2 patch: tax columns mapped with COALESCE defaults; discount columns normalized
INSERT INTO sales_items (
  id,
  sale_id,
  product_id,
  product_name,
  sku,
  quantity,
  unit_price,
  total,
  discount,
  discount_percentage,
  discount_amount,
  tax_percentage,
  tax_amount,
  variation_id,
  company_id,
  created_at
)
SELECT
  si.id,
  si.sale_id,
  si.product_id,
  si.product_name,
  si.sku,
  si.quantity,
  COALESCE(si.unit_price, si.price, 0)            AS unit_price,
  si.total,
  COALESCE(si.discount, 0)                         AS discount,
  COALESCE(si.discount_percentage, 0)              AS discount_percentage,
  COALESCE(si.discount_amount, si.discount, 0)     AS discount_amount,
  COALESCE(si.tax_percentage, 0)                   AS tax_percentage,
  COALESCE(si.tax_amount, si.tax, 0)               AS tax_amount,
  si.variation_id,
  -- Derive company_id from parent sales row if sale_items.company_id is null
  COALESCE(si.company_id, (SELECT s.company_id FROM sales s WHERE s.id = si.sale_id)) AS company_id,
  si.created_at
FROM sale_items si
WHERE NOT EXISTS (
  SELECT 1 FROM sales_items sis WHERE sis.sale_id = si.sale_id
)
ON CONFLICT (id) DO NOTHING;  -- safety: skip if id already exists in sales_items

-- Step 3: Count post-migration
DO $$
DECLARE
  v_migrated INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_migrated FROM sales_items sis
  WHERE EXISTS (SELECT 1 FROM sale_items si WHERE si.id = sis.id);
  RAISE NOTICE 'POST-MIGRATION: % sale_items rows now have a counterpart in sales_items', v_migrated;
END $$;

COMMIT;

-- ─── POST-MIGRATION VERIFY ────────────────────────────────────────────────────

-- Verify 1: All sale_ids in sale_items are now represented in sales_items
-- SUCCESS: 0 rows
SELECT COUNT(DISTINCT sale_id) AS remaining_legacy_only
FROM sale_items
WHERE NOT EXISTS (
  SELECT 1 FROM sales_items sis WHERE sis.sale_id = sale_items.sale_id
);

-- Verify 2: sale_return_items with FK to sale_items — confirm they now resolve in sales_items
SELECT
  COUNT(*) AS return_items_total,
  COUNT(sis.id) AS resolve_in_sales_items,
  COUNT(*) - COUNT(sis.id) AS unresolved
FROM sale_return_items sri
LEFT JOIN sales_items sis ON sis.id = sri.sale_item_id
WHERE sri.sale_item_id IS NOT NULL;
-- SUCCESS: unresolved = 0

-- Verify 3: Row count comparison post-migration
SELECT
  'sale_items (legacy)' AS table_name,
  COUNT(*) AS total_rows,
  MIN(created_at) AS earliest,
  MAX(created_at) AS latest
FROM sale_items
UNION ALL
SELECT
  'sales_items (canonical)' AS table_name,
  COUNT(*) AS total_rows,
  MIN(created_at) AS earliest,
  MAX(created_at) AS latest
FROM sales_items;
-- sales_items count should be >= sale_items count (sales_items also has new records)

-- ─── FUTURE: Drop sequence (DO NOT RUN UNTIL VERIFIED) ──────────────────────
-- Only run after all read fallbacks removed from application code.
-- Run verify_sale_items_no_new_writes.sql CHECK 3 → must be 0 rows.

-- Step 1: Rename (safe — preserves data for 30-day monitoring)
--   ALTER TABLE sale_items RENAME TO sale_items_archived_20260412;

-- Step 2: After 30 days of no issues:
--   DROP TABLE sale_items_archived_20260412;
