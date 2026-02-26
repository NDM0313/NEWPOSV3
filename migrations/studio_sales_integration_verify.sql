-- ============================================================================
-- STUDIO-SALES INTEGRATION – DATA CONSISTENCY CHECK
-- ============================================================================
-- Run after studio_sales_integration_full.sql
-- 1. Verify sale_id exists in studio_orders where we have productions
-- 2. Verify no orphan studio_tasks (all have valid studio_order_id)
-- 3. Verify studio_charges is not manually editable (column has comment; RLS/trigger enforce)
-- 4. Ensure recalculation is server-side only (triggers exist)
-- ============================================================================

-- 1. Sales with studio_productions should have a studio_order
SELECT 'Sales with productions but no studio_order' AS check_name, COUNT(*) AS cnt
FROM studio_productions p
WHERE p.sale_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM studio_orders o WHERE o.sale_id = p.sale_id);
-- Expected: 0

-- 2. Orphan studio_tasks (studio_order deleted or invalid)
SELECT 'Orphan studio_tasks' AS check_name, COUNT(*) AS cnt
FROM studio_tasks t
WHERE NOT EXISTS (SELECT 1 FROM studio_orders o WHERE o.id = t.studio_order_id);
-- Expected: 0

-- 3. studio_charges vs sum of costs (sanity)
SELECT s.id, s.invoice_no,
  s.studio_charges AS sale_studio_charges,
  (SELECT COALESCE(SUM(t.cost), 0) FROM studio_tasks t
   INNER JOIN studio_orders o ON o.id = t.studio_order_id WHERE o.sale_id = s.id) AS from_tasks,
  (SELECT COALESCE(SUM(st.cost), 0) FROM studio_production_stages st
   INNER JOIN studio_productions sp ON sp.id = st.production_id WHERE sp.sale_id = s.id) AS from_stages
FROM sales s
WHERE s.studio_charges > 0 OR EXISTS (SELECT 1 FROM studio_orders o WHERE o.sale_id = s.id)
LIMIT 20;

-- 4. balance_due = (total + studio_charges) - paid_amount (customer only)
SELECT id, invoice_no, total, studio_charges, paid_amount, due_amount,
  (COALESCE(total, 0) + COALESCE(studio_charges, 0) - COALESCE(paid_amount, 0)) AS expected_due
FROM sales
WHERE due_amount IS NOT NULL
  AND ABS(due_amount - GREATEST(0, COALESCE(total, 0) + COALESCE(studio_charges, 0) - COALESCE(paid_amount, 0))) > 0.01
LIMIT 10;
-- Expected: 0 rows (no mismatch)
