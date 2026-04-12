-- =====================================================================
-- VERIFY: sale_return_items FK Integrity After sale_items Migration
-- Purpose : Confirm that sale_return_items.sale_item_id FKs remain valid
--           after the data migration. The FK currently points to sale_items(id).
--           After migration, the same IDs exist in sales_items(id), so the
--           FK references are maintained without ALTER TABLE.
-- Safe    : SELECT only. No modifications.
-- Context : 38_SALE_ITEMS_MIGRATION_AND_READ_RETIREMENT,
--           44_SALE_ITEMS_EXECUTION_READY_MIGRATION
-- Run after: sale_items_data_migration.sql
-- =====================================================================

-- ─── CHECK 1: Overall FK resolution — critical metric ────────────────────────
-- After migration: ALL non-null sale_item_id values must resolve in sales_items.
-- SUCCESS: unresolved = 0
-- FAILURE: unresolved > 0 → some historical return items point to sale_items rows
--          that were not migrated. Investigate CHECK 3 for those sale_ids.
SELECT
  COUNT(*)                         AS return_items_total,
  COUNT(*) FILTER (WHERE sri.sale_item_id IS NULL)     AS null_sale_item_id,
  COUNT(sis.id)                    AS resolve_in_sales_items,
  COUNT(*) FILTER (WHERE sri.sale_item_id IS NOT NULL AND sis.id IS NULL) AS unresolved
FROM sale_return_items sri
LEFT JOIN sales_items sis ON sis.id = sri.sale_item_id;
-- SUCCESS post-migration: unresolved = 0
-- null_sale_item_id: returns that had no line item reference (acceptable, ON DELETE SET NULL)

-- ─── CHECK 2: Return items still only in sale_items (not yet migrated) ────────
-- Rows that exist in sale_return_items pointing to sale_items IDs that were NOT
-- yet copied to sales_items. These are the blocking items for FK migration.
SELECT
  sri.id AS return_item_id,
  sri.sale_return_id,
  sri.sale_item_id,
  sri.product_name,
  sri.quantity,
  sr.company_id,
  sr.created_at AS return_created_at
FROM sale_return_items sri
JOIN sale_returns sr ON sr.id = sri.sale_return_id
WHERE sri.sale_item_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sales_items sis WHERE sis.id = sri.sale_item_id
  )
  AND EXISTS (
    SELECT 1 FROM sale_items si WHERE si.id = sri.sale_item_id
  )
ORDER BY sr.created_at DESC
LIMIT 50;
-- SUCCESS post-migration: 0 rows
-- If rows exist: these sale_item_id values were NOT copied to sales_items.
-- This means the sale_id for those items was NOT in the legacy-only set
-- (i.e., the sale already had rows in sales_items, so migration skipped it)
-- Action: manual INSERT of those specific sale_items rows into sales_items

-- ─── CHECK 3: NULL sale_item_id returns (expected / acceptable) ───────────────
-- Returns where sale_item_id is NULL (set by ON DELETE SET NULL from old schema,
-- or returns that don't reference a specific line item).
-- These are NOT a problem — they just lack the line-item link.
SELECT
  sr.company_id,
  COUNT(*) AS returns_without_item_ref,
  MIN(sr.created_at) AS earliest,
  MAX(sr.created_at) AS latest
FROM sale_return_items sri
JOIN sale_returns sr ON sr.id = sri.sale_return_id
WHERE sri.sale_item_id IS NULL
GROUP BY sr.company_id
ORDER BY sr.company_id;

-- ─── CHECK 4: Sale IDs in sale_return_items that were skipped by migration ────
-- The migration skips sale_ids that already have rows in sales_items (by sale_id).
-- If those skipped sale_ids have return items, the return items' FKs may not resolve.
-- This identifies the at-risk case.
SELECT DISTINCT
  si.sale_id,
  COUNT(si.id) AS items_in_sale_items,
  COUNT(sis.id) AS items_in_sales_items,
  EXISTS (SELECT 1 FROM sale_return_items sri WHERE sri.sale_item_id IN (SELECT id FROM sale_items WHERE sale_id = si.sale_id)) AS has_return_items
FROM sale_items si
LEFT JOIN sales_items sis ON sis.sale_id = si.sale_id
GROUP BY si.sale_id
HAVING COUNT(sis.id) > 0  -- these were SKIPPED by migration (already had sales_items rows)
   AND EXISTS (SELECT 1 FROM sale_return_items sri WHERE sri.sale_item_id IN (SELECT id FROM sale_items WHERE sale_id = si.sale_id))
ORDER BY si.sale_id
LIMIT 20;
-- These sales had BOTH sale_items and sales_items rows AND have return items.
-- The return item FKs point to sale_items.id — which should exist in sales_items.id
-- ONLY if those specific IDs were copied. If they weren't (due to sale_id skip),
-- those rows must be manually inserted.

-- ─── CHECK 5: FK remap readiness — pre-validation for future ALTER TABLE ──────
-- When ready to remap FK from sale_items(id) → sales_items(id):
-- This check confirms all referenced IDs now exist in sales_items.
SELECT
  CASE
    WHEN (SELECT COUNT(*) FROM sale_return_items WHERE sale_item_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM sales_items sis WHERE sis.id = sale_return_items.sale_item_id)
         ) = 0
    THEN 'READY FOR FK REMAP'
    ELSE 'NOT READY — unresolved FKs exist'
  END AS fk_remap_readiness;
