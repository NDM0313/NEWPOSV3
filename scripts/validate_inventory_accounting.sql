-- ============================================================================
-- STEP 9 — Data consistency checks (inventory vs accounting)
-- ============================================================================
-- Run against test or production DB. Reports only; no updates.
-- ============================================================================

-- 1) Inventory vs ledger: FG account balance vs sum of PRODUCTION stock_movements (total_cost)
SELECT 'FG inventory vs ledger' AS check_name,
  (SELECT COALESCE(SUM(total_cost), 0) FROM stock_movements WHERE movement_type = 'PRODUCTION') AS stock_fg_value,
  (SELECT COALESCE(SUM(jel.debit - jel.credit), 0) FROM journal_entry_lines jel
   JOIN accounts a ON a.id = jel.account_id WHERE a.code = '1220') AS ledger_fg_balance;

-- 2) Stock movements vs sales: count of SALE movements per sale
SELECT 'Sale stock movements' AS check_name, s.id AS sale_id, s.invoice_no, s.status,
  (SELECT COUNT(*) FROM stock_movements sm WHERE sm.reference_type = 'sale' AND sm.reference_id = s.id) AS movement_count,
  (SELECT COUNT(*) FROM sales_items si WHERE si.sale_id = s.id) AS line_count
FROM sales s
WHERE s.status = 'final'
ORDER BY s.updated_at DESC
LIMIT 20;

-- 3) Production cost vs COGS: studio productions with actual_cost vs COGS journal for that sale
SELECT 'Production cost vs COGS' AS check_name, sp.id AS production_id, sp.production_no, sp.actual_cost,
  je.id AS cogs_je_id, je.total_debit AS cogs_amount
FROM studio_productions sp
LEFT JOIN journal_entries je ON je.reference_type = 'sale' AND je.reference_id = sp.sale_id
  AND je.description LIKE 'COGS%'
WHERE sp.generated_product_id IS NOT NULL
LIMIT 20;

-- 4) Orphan productions: no sale_id or sale deleted
SELECT 'Orphan productions' AS check_name, id, production_no, sale_id
FROM studio_productions
WHERE sale_id IS NULL OR NOT EXISTS (SELECT 1 FROM sales WHERE id = studio_productions.sale_id);

-- 5) Orphan stock movements: reference_id points to missing record
SELECT 'Orphan stock_movements (studio_production)' AS check_name, sm.id, sm.reference_id
FROM stock_movements sm
WHERE sm.reference_type = 'studio_production'
  AND NOT EXISTS (SELECT 1 FROM studio_productions WHERE id = sm.reference_id)
LIMIT 20;
