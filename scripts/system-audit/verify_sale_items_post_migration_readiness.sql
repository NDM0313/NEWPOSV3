-- =====================================================================
-- VERIFY: sale_items Pre/Post Migration Readiness
-- Purpose : Run BEFORE executing sale_items_data_migration.sql to
--           confirm the migration is safe and assess scope.
--           Run AFTER to confirm success.
-- Safe    : SELECT only. No modifications.
-- Context : 38_SALE_ITEMS_MIGRATION_AND_READ_RETIREMENT,
--           44_SALE_ITEMS_EXECUTION_READY_MIGRATION
-- =====================================================================

-- ─── CHECK A: Legacy-only sales (primary migration target) ────────────────────
-- These sale_ids exist in sale_items but have NO rows in sales_items.
-- This is the exact set the migration will INSERT.
-- SUCCESS (pre-migration): N rows (N = number of historical sales to migrate)
-- SUCCESS (post-migration): 0 rows
SELECT COUNT(DISTINCT sale_id) AS legacy_only_sale_ids
FROM sale_items
WHERE NOT EXISTS (
  SELECT 1 FROM sales_items sis WHERE sis.sale_id = sale_items.sale_id
);

-- ─── CHECK B: Breakdown of legacy-only sales by age ──────────────────────────
-- Understand the age distribution of data that needs migration
SELECT
  CASE
    WHEN s.created_at >= NOW() - INTERVAL '3 months' THEN 'Last 3 months'
    WHEN s.created_at >= NOW() - INTERVAL '1 year'   THEN '3-12 months ago'
    ELSE 'Older than 1 year'
  END AS age_bucket,
  COUNT(DISTINCT si.sale_id) AS sales_count,
  COUNT(si.id) AS items_count
FROM sale_items si
JOIN sales s ON s.id = si.sale_id
WHERE NOT EXISTS (
  SELECT 1 FROM sales_items sis WHERE sis.sale_id = si.sale_id
)
GROUP BY 1
ORDER BY 1;

-- ─── CHECK C: company_id availability in sale_items ──────────────────────────
-- Determines whether the COALESCE(si.company_id, subquery) path is needed.
-- SUCCESS (ideal): 0 rows without company_id (no subquery needed)
-- Expected: Some rows may lack company_id in legacy schema — COALESCE handles this.
SELECT
  COUNT(*) FILTER (WHERE company_id IS NOT NULL) AS has_company_id,
  COUNT(*) FILTER (WHERE company_id IS NULL)     AS missing_company_id,
  COUNT(*)                                        AS total_rows
FROM sale_items
WHERE NOT EXISTS (
  SELECT 1 FROM sales_items sis WHERE sis.sale_id = sale_items.sale_id
);

-- ─── CHECK D: ID collision check — MUST be 0 before running migration ─────────
-- If any sale_items.id already exists in sales_items.id, the migration will
-- skip those rows (ON CONFLICT DO NOTHING). Non-zero means overlap exists.
SELECT COUNT(*) AS id_collisions
FROM sale_items si
JOIN sales_items sis ON sis.id = si.id;
-- SUCCESS: 0 (safe to run migration as-is)
-- If > 0: investigate before proceeding

-- ─── CHECK E: Column existence sanity check ──────────────────────────────────
-- Confirm sales_items has the target columns the migration writes to.
-- Run this to detect schema mismatch before the INSERT fails mid-transaction.
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'sales_items'
  AND column_name IN ('id', 'sale_id', 'product_id', 'unit_price', 'total',
                      'discount', 'discount_percentage', 'discount_amount',
                      'tax_percentage', 'tax_amount', 'variation_id',
                      'company_id', 'created_at')
ORDER BY column_name;
-- Verify: all listed columns must be present. Missing columns = migration will fail.

-- ─── CHECK F: Row counts both tables (scale overview) ─────────────────────────
SELECT
  'sale_items (legacy)'   AS table_name,
  COUNT(*)                AS total_rows,
  MIN(created_at)         AS earliest,
  MAX(created_at)         AS latest
FROM sale_items
UNION ALL
SELECT
  'sales_items (canonical)' AS table_name,
  COUNT(*)                  AS total_rows,
  MIN(created_at)           AS earliest,
  MAX(created_at)           AS latest
FROM sales_items;

-- ─── POST-MIGRATION: Verify migration success ─────────────────────────────────
-- Run AFTER executing sale_items_data_migration.sql
-- SUCCESS: 0 for Check A, 0 for Check D
SELECT
  (SELECT COUNT(DISTINCT sale_id) FROM sale_items
   WHERE NOT EXISTS (SELECT 1 FROM sales_items sis WHERE sis.sale_id = sale_items.sale_id)
  ) AS remaining_legacy_only,
  (SELECT COUNT(*) FROM sale_items si JOIN sales_items sis ON sis.id = si.id
  ) AS successfully_migrated_ids;
-- remaining_legacy_only = 0 means migration covered all sales
-- successfully_migrated_ids = rows migrated (should match Check B total items_count)
