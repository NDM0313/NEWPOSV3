-- DIN CHINA — read-only stock adjustment diagnosis
-- Run:
--   Get-Content scripts/sql/diag_din_china_stock_adjustments.sql -Raw | ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres"

\set company_id '30bd8592-3384-4f34-899a-f3907e336485'

SELECT '=== 1. Adjustment movement summary ===' AS section;
SELECT
  COUNT(*) AS adjustment_rows,
  ROUND(COALESCE(SUM(quantity), 0)::numeric, 4) AS adjustment_qty_sum,
  COUNT(DISTINCT product_id) AS products_touched
FROM stock_movements sm
WHERE sm.company_id = :'company_id'::uuid
  AND LOWER(TRIM(COALESCE(sm.movement_type, ''))) = 'adjustment';

SELECT '=== 2. Adjustments by reference_type ===' AS section;
SELECT
  COALESCE(NULLIF(TRIM(reference_type), ''), '(null)') AS reference_type,
  COUNT(*) AS rows,
  ROUND(COALESCE(SUM(quantity), 0)::numeric, 4) AS qty_sum
FROM stock_movements sm
WHERE sm.company_id = :'company_id'::uuid
  AND LOWER(TRIM(COALESCE(sm.movement_type, ''))) = 'adjustment'
GROUP BY 1
ORDER BY rows DESC;

SELECT '=== 3. Linked journal entries (active) ===' AS section;
SELECT
  sm.id AS movement_id,
  sm.created_at::date AS mv_date,
  p.sku,
  p.name AS product_name,
  sm.quantity,
  sm.reference_type,
  je.entry_no,
  je.reference_type AS je_ref_type,
  ROUND(COALESCE(je.total_debit, 0)::numeric, 2) AS je_amount
FROM stock_movements sm
LEFT JOIN products p ON p.id = sm.product_id
LEFT JOIN journal_entries je ON je.reference_id = sm.id
  AND je.reference_type IN ('stock_adjustment', 'opening_balance')
  AND COALESCE(je.is_void, false) = false
WHERE sm.company_id = :'company_id'::uuid
  AND LOWER(TRIM(COALESCE(sm.movement_type, ''))) = 'adjustment'
ORDER BY sm.created_at DESC
LIMIT 200;

SELECT '=== 4. Per-product stock: all movements vs without adjustments ===' AS section;
WITH all_mv AS (
  SELECT
    sm.product_id,
    sm.variation_id,
    ROUND(COALESCE(SUM(sm.quantity), 0)::numeric, 4) AS stock_all
  FROM stock_movements sm
  WHERE sm.company_id = :'company_id'::uuid
  GROUP BY sm.product_id, sm.variation_id
),
no_adj AS (
  SELECT
    sm.product_id,
    sm.variation_id,
    ROUND(COALESCE(SUM(sm.quantity), 0)::numeric, 4) AS stock_no_adj
  FROM stock_movements sm
  WHERE sm.company_id = :'company_id'::uuid
    AND LOWER(TRIM(COALESCE(sm.movement_type, ''))) <> 'adjustment'
  GROUP BY sm.product_id, sm.variation_id
)
SELECT
  p.sku,
  p.name,
  pv.sku AS variation_sku,
  COALESCE(a.stock_all, 0) AS stock_all,
  COALESCE(n.stock_no_adj, 0) AS stock_without_adjustments,
  ROUND(COALESCE(a.stock_all, 0) - COALESCE(n.stock_no_adj, 0), 4) AS adjustment_delta
FROM all_mv a
FULL OUTER JOIN no_adj n
  ON n.product_id = a.product_id
 AND COALESCE(n.variation_id, '00000000-0000-0000-0000-000000000000'::uuid)
   = COALESCE(a.variation_id, '00000000-0000-0000-0000-000000000000'::uuid)
JOIN products p ON p.id = COALESCE(a.product_id, n.product_id)
LEFT JOIN product_variations pv ON pv.id = COALESCE(a.variation_id, n.variation_id)
WHERE p.company_id = :'company_id'::uuid
  AND ABS(COALESCE(a.stock_all, 0) - COALESCE(n.stock_no_adj, 0)) > 0.0001
ORDER BY ABS(COALESCE(a.stock_all, 0) - COALESCE(n.stock_no_adj, 0)) DESC
LIMIT 100;

SELECT '=== 5. Negative stock products (all movements) ===' AS section;
SELECT
  p.sku,
  p.name,
  pv.sku AS variation_sku,
  ROUND(COALESCE(SUM(sm.quantity), 0)::numeric, 4) AS stock_all
FROM stock_movements sm
JOIN products p ON p.id = sm.product_id
LEFT JOIN product_variations pv ON pv.id = sm.variation_id
WHERE sm.company_id = :'company_id'::uuid
GROUP BY p.sku, p.name, pv.sku, sm.product_id, sm.variation_id
HAVING COALESCE(SUM(sm.quantity), 0) < -0.0001
ORDER BY stock_all ASC
LIMIT 50;

SELECT '=== 6. SKU 0018 / COTTON WHITE ===' AS section;
SELECT
  p.sku,
  p.name,
  ROUND(COALESCE(SUM(sm.quantity), 0)::numeric, 4) AS stock_all,
  ROUND(COALESCE(SUM(sm.quantity) FILTER (
    WHERE LOWER(TRIM(COALESCE(sm.movement_type, ''))) <> 'adjustment'
  ), 0)::numeric, 4) AS stock_without_adjustments
FROM stock_movements sm
JOIN products p ON p.id = sm.product_id
WHERE sm.company_id = :'company_id'::uuid
  AND (p.sku = '0018' OR p.name ILIKE '%COTTON WHITE%')
GROUP BY p.sku, p.name, sm.product_id, sm.variation_id;

SELECT '=== 7. Movement IDs for purge (copy for exclude list) ===' AS section;
SELECT sm.id AS movement_id
FROM stock_movements sm
WHERE sm.company_id = :'company_id'::uuid
  AND LOWER(TRIM(COALESCE(sm.movement_type, ''))) = 'adjustment'
ORDER BY sm.created_at;

SELECT '=== 8. Inventory GL 1200 cached vs journal ===' AS section;
SELECT a.code, a.name, a.balance AS cached_balance,
  (
    SELECT ROUND(COALESCE(SUM(jel.credit - jel.debit), 0)::numeric, 2)
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    WHERE jel.account_id = a.id AND COALESCE(je.is_void, false) = false
  ) AS journal_net_credit_minus_debit
FROM accounts a
WHERE a.company_id = :'company_id'::uuid
  AND a.code = '1200'
  AND COALESCE(a.is_active, true) = true;
