-- verify_sale_items_vs_sales_items_usage.sql
-- Purpose: Detect double-count exposure by finding sales that have line items
--          in BOTH the legacy sale_items table AND the canonical sales_items table,
--          and flag sales that exist in one table only.
-- Severity: P1 — dashboardService.ts reads both tables; a sale with lines in both
--           tables will be double-counted in revenue and COGS reports.
-- Run: read-only; no writes.
-- Expected output:
--   Section 1 — sales with lines in BOTH tables (highest risk — double-count).
--   Section 2 — sales with lines in legacy sale_items only (missed migration).
--   Section 3 — totals for visibility.

-- ============================================================
-- Section 1: Sales with line items in BOTH tables (double-count risk)
-- ============================================================
SELECT
    'DOUBLE_COUNT_RISK'             AS finding,
    s.id                            AS sale_id,
    s.reference_number,
    s.status,
    s.created_at::DATE              AS sale_date,
    COUNT(DISTINCT si.id)           AS sales_items_count,
    COUNT(DISTINCT sli.id)          AS sale_items_legacy_count,
    SUM(si.total)                   AS sales_items_total,
    SUM(sli.total)                  AS sale_items_legacy_total
FROM sales s
JOIN sales_items si
    ON si.sale_id = s.id
JOIN sale_items sli
    ON sli.sale_id = s.id
GROUP BY s.id, s.reference_number, s.status, s.created_at
ORDER BY s.created_at DESC;

-- ============================================================
-- Section 2: Sales with lines ONLY in legacy sale_items (not in canonical)
-- ============================================================
SELECT
    'LEGACY_ONLY'                   AS finding,
    s.id                            AS sale_id,
    s.reference_number,
    s.status,
    s.created_at::DATE              AS sale_date,
    COUNT(sli.id)                   AS sale_items_legacy_count,
    SUM(sli.total)                  AS sale_items_legacy_total
FROM sales s
JOIN sale_items sli
    ON sli.sale_id = s.id
WHERE NOT EXISTS (
    SELECT 1 FROM sales_items si WHERE si.sale_id = s.id
)
GROUP BY s.id, s.reference_number, s.status, s.created_at
ORDER BY s.created_at DESC;

-- ============================================================
-- Section 3: Aggregate summary
-- ============================================================
SELECT
    'SUMMARY'                           AS finding,
    COUNT(DISTINCT s.id)                AS total_sales,
    SUM(CASE WHEN has_both  THEN 1 ELSE 0 END) AS sales_in_both_tables,
    SUM(CASE WHEN legacy_only THEN 1 ELSE 0 END) AS sales_in_legacy_only,
    SUM(CASE WHEN canonical_only THEN 1 ELSE 0 END) AS sales_in_canonical_only
FROM (
    SELECT
        s.id,
        EXISTS(SELECT 1 FROM sales_items si  WHERE si.sale_id  = s.id)  AS has_canonical,
        EXISTS(SELECT 1 FROM sale_items  sli WHERE sli.sale_id = s.id)  AS has_legacy,
        (
            EXISTS(SELECT 1 FROM sales_items si  WHERE si.sale_id  = s.id)
            AND
            EXISTS(SELECT 1 FROM sale_items  sli WHERE sli.sale_id = s.id)
        ) AS has_both,
        (
            NOT EXISTS(SELECT 1 FROM sales_items si WHERE si.sale_id = s.id)
            AND EXISTS(SELECT 1 FROM sale_items sli WHERE sli.sale_id = s.id)
        ) AS legacy_only,
        (
            EXISTS(SELECT 1 FROM sales_items si WHERE si.sale_id = s.id)
            AND NOT EXISTS(SELECT 1 FROM sale_items sli WHERE sli.sale_id = s.id)
        ) AS canonical_only
    FROM sales s
) s;
