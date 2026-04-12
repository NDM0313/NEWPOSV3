-- =====================================================================
-- VERIFY: sale_items No New Writes Post P1-2 Patch
-- Purpose : Confirm that the legacy `sale_items` table has received
--           no new rows since the P1-2 patch on 2026-04-12.
-- Safe    : SELECT only. No modifications.
-- Context : 29_P1_SALE_ITEMS_LEGACY_ELIMINATION, 35_POST_PATCH_VERIFICATION_AND_REPAIR_RUNBOOK section 3
-- =====================================================================

-- ─── CHECK 1: Any writes after patch date ─────────────────────────────────────
-- SUCCESS: 0 rows
-- FAILURE: New rows → find origin (studioProductionService fallback still writing to sale_items?)
SELECT
  id,
  sale_id,
  product_id,
  product_name,
  quantity,
  created_at
FROM sale_items
WHERE created_at > '2026-04-12'
ORDER BY created_at DESC;

-- ─── CHECK 2: Row count comparison sale_items vs sales_items ─────────────────
-- Shows relative scale of legacy vs canonical data
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

-- ─── CHECK 3: Sales that have items ONLY in sale_items (no migration yet) ────
-- These are the records that need data migration before sale_items can be dropped
SELECT
  si.sale_id,
  COUNT(si.id) AS item_count_in_legacy,
  s.invoice_no,
  s.company_id,
  s.created_at AS sale_created_at
FROM sale_items si
JOIN sales s ON s.id = si.sale_id
WHERE NOT EXISTS (
  SELECT 1 FROM sales_items sis WHERE sis.sale_id = si.sale_id
)
GROUP BY si.sale_id, s.invoice_no, s.company_id, s.created_at
ORDER BY s.created_at DESC
LIMIT 50;

-- ─── CHECK 4: Sales with items in BOTH tables (overlap) ──────────────────────
SELECT
  si.sale_id,
  COUNT(DISTINCT si.id) AS legacy_items,
  COUNT(DISTINCT sis.id) AS canonical_items,
  s.invoice_no
FROM sale_items si
JOIN sales s ON s.id = si.sale_id
JOIN sales_items sis ON sis.sale_id = si.sale_id
GROUP BY si.sale_id, s.invoice_no
ORDER BY si.sale_id
LIMIT 50;

-- ─── CHECK 5: Any studio-linked items in sale_items (should be 0 post P1-2) ──
-- studio lines should now go to sales_items
SELECT
  si.id,
  si.sale_id,
  si.product_id,
  si.created_at,
  CASE WHEN si.is_studio_product IS TRUE THEN 'studio' ELSE 'non-studio' END AS product_origin
FROM sale_items si
WHERE si.created_at > '2026-04-12'
  AND si.is_studio_product IS TRUE;
-- SUCCESS: 0 rows
