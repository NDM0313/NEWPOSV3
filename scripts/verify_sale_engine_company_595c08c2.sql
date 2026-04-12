-- =====================================================================
-- VERIFICATION: Sale Engine Full Audit — Company 595c08c2
-- Purpose  : Identify discount allocation bugs, inventory JE cost-basis issues,
--            settlement JE accuracy, and partial-return correctness.
-- Safe     : All SELECT only. No modifications.
-- Company  : 595c08c2-1e47-4581-89c9-1f78de51c613
-- Date     : 2026-04-12
-- Context  : FINAL_COMPANY_595C08C2_SALE_ENGINE_FULL_AUDIT_AND_REPAIR
-- =====================================================================

-- ─── CHECK A ─────────────────────────────────────────────────────────────────
-- All sales with invoice-level discounts for company 595c08c2.
-- Expected: Any rows here are candidates for discount propagation check in CHECK B.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  id,
  invoice_no,
  customer_name,
  subtotal,
  discount_amount,
  total,
  status,
  created_at
FROM sales
WHERE company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'
  AND discount_amount > 0
ORDER BY created_at DESC;

-- ─── CHECK B ─────────────────────────────────────────────────────────────────
-- All sale returns linked to discounted sales.
-- Diagnoses whether the return header inherited the proportional discount.
-- Expected post-fix: all linked returns have discount_amount > 0 when original did.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  sr.id            AS return_id,
  sr.return_no,
  sr.status        AS return_status,
  sr.subtotal      AS return_subtotal,
  sr.discount_amount AS return_discount,
  sr.total         AS return_total,
  s.invoice_no,
  s.customer_name,
  s.subtotal       AS sale_subtotal,
  s.discount_amount AS sale_discount,
  s.total          AS sale_total,
  CASE
    WHEN s.discount_amount > 0 AND sr.discount_amount = 0
      THEN 'MISSING DISCOUNT — settlement JE is GROSS, not net'
    WHEN s.discount_amount > 0 AND sr.discount_amount > 0
      THEN 'HAS DISCOUNT — verify proportionality in CHECK B2'
    ELSE 'OK (no discount on original sale)'
  END AS discount_status,
  -- Expected proportional discount for full return:
  CASE
    WHEN s.subtotal > 0 AND s.discount_amount > 0
      THEN ROUND((s.discount_amount / s.subtotal * sr.subtotal)::NUMERIC, 2)
    ELSE 0
  END AS expected_proportional_discount,
  sr.created_at
FROM sale_returns sr
JOIN sales s ON s.id = sr.original_sale_id
WHERE sr.company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'
ORDER BY sr.created_at DESC;

-- ─── CHECK B2 ─────────────────────────────────────────────────────────────────
-- Proportional discount accuracy check.
-- Flags returns where the discount rate differs from the original sale by > 0.1%.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  sr.return_no,
  sr.subtotal      AS return_subtotal,
  sr.discount_amount AS return_discount,
  s.subtotal       AS sale_subtotal,
  s.discount_amount AS sale_discount,
  CASE WHEN s.subtotal > 0 THEN ROUND((s.discount_amount / s.subtotal * 100)::NUMERIC, 4) END AS sale_discount_rate_pct,
  CASE WHEN sr.subtotal > 0 THEN ROUND((sr.discount_amount / sr.subtotal * 100)::NUMERIC, 4) END AS return_discount_rate_pct,
  ABS(
    COALESCE(sr.discount_amount / NULLIF(sr.subtotal, 0), 0) -
    COALESCE(s.discount_amount / NULLIF(s.subtotal, 0), 0)
  ) AS rate_diff
FROM sale_returns sr
JOIN sales s ON s.id = sr.original_sale_id
WHERE sr.company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'
  AND s.discount_amount > 0
  AND sr.discount_amount > 0
  AND ABS(
    COALESCE(sr.discount_amount / NULLIF(sr.subtotal, 0), 0) -
    COALESCE(s.discount_amount / NULLIF(s.subtotal, 0), 0)
  ) > 0.001
ORDER BY rate_diff DESC;

-- ─── CHECK C ─────────────────────────────────────────────────────────────────
-- Settlement JE debit amount vs sale_return.total — detect gross vs net mismatch.
-- The settlement JE Dr Sales Revenue amount MUST equal sale_return.total (net).
-- Expected: 0 rows with discrepancy > 0.01.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  sr.return_no,
  sr.total         AS return_net_total,
  sr.discount_amount AS return_discount,
  je.id            AS je_id,
  je.action_fingerprint,
  SUM(jel.debit)   AS settlement_je_debit,
  ABS(SUM(jel.debit) - sr.total) AS discrepancy,
  CASE
    WHEN ABS(SUM(jel.debit) - sr.total) < 0.01 THEN 'MATCH'
    WHEN SUM(jel.debit) > sr.total THEN 'JE > return total — gross vs net bug'
    ELSE 'JE < return total — underpayment'
  END AS status
FROM sale_returns sr
JOIN journal_entries je ON je.reference_id = sr.id AND je.reference_type = 'sale_return'
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN accounts a ON a.id = jel.account_id AND a.code IN ('4000','4100','4010')
WHERE sr.company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'
  AND (je.is_void IS NULL OR je.is_void = FALSE)
GROUP BY sr.return_no, sr.total, sr.discount_amount, je.id, je.action_fingerprint
ORDER BY discrepancy DESC;

-- ─── CHECK D ─────────────────────────────────────────────────────────────────
-- Inventory JE cost-basis: compare sales_items.total (selling price) vs
-- stock_movements.total_cost (purchase cost) for original sales.
-- Determines whether Bug 2 (inventory JE uses wrong basis) is material.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  s.invoice_no,
  s.customer_name,
  si.product_id,
  si.quantity                      AS sale_qty,
  si.unit_price                    AS sell_unit_price,
  si.total                         AS sell_total,
  sm.unit_cost                     AS orig_cost_unit,
  sm.total_cost                    AS orig_cost_total,
  COALESCE(si.total, 0) - COALESCE(sm.total_cost, 0) AS selling_minus_cost,
  CASE
    WHEN sm.total_cost IS NULL THEN 'NO STOCK MOVEMENT FOUND'
    WHEN ABS(si.total - COALESCE(sm.total_cost, 0)) < 0.01 THEN 'MATCH (cost = selling price)'
    WHEN si.total > COALESCE(sm.total_cost, 0) THEN 'SELLING > COST (margin exists)'
    ELSE 'SELLING < COST (negative margin)'
  END AS basis_status
FROM sales s
JOIN sales_items si ON si.sale_id = s.id
LEFT JOIN stock_movements sm
  ON  sm.reference_id   = s.id
  AND sm.reference_type = 'sale'
  AND sm.movement_type  = 'sale'
  AND sm.product_id     = si.product_id
WHERE s.company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'
ORDER BY s.created_at DESC
LIMIT 100;

-- ─── CHECK E ─────────────────────────────────────────────────────────────────
-- Partial return item totals: verify sale_return_items.total is proportional.
-- For each return item: |actual_total - (qty / orig_qty * orig_line_total)| should be < 0.01.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  sr.return_no,
  sri.product_id,
  sri.quantity                     AS return_qty,
  sri.unit_price                   AS return_unit_price,
  sri.total                        AS return_item_total,
  si.quantity                      AS orig_qty,
  si.unit_price                    AS orig_unit_price,
  si.total                         AS orig_line_total,
  CASE
    WHEN si.quantity > 0
      THEN ROUND((sri.quantity / si.quantity * si.total)::NUMERIC, 2)
    ELSE NULL
  END AS expected_return_total,
  CASE
    WHEN si.quantity > 0
      THEN ABS(sri.total - (sri.quantity / si.quantity * si.total))
    ELSE NULL
  END AS item_total_discrepancy,
  CASE
    WHEN si.quantity > 0 AND ABS(sri.total - (sri.quantity / si.quantity * si.total)) < 0.01
      THEN 'OK'
    WHEN si.quantity > 0
      THEN 'DISCREPANCY — partial return total is not proportional'
    ELSE 'CANNOT VERIFY'
  END AS status
FROM sale_returns sr
JOIN sale_return_items sri ON sri.sale_return_id = sr.id
JOIN sales_items si ON si.id = sri.sale_item_id
WHERE sr.company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'
  AND sri.quantity < si.quantity  -- only partial returns
ORDER BY sr.created_at DESC;

-- ─── COMBINED SUMMARY ─────────────────────────────────────────────────────────
-- One-shot view of all returns: discount status, settlement accuracy, inv JE count.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  sr.return_no,
  sr.status,
  s.invoice_no,
  s.customer_name,
  s.discount_amount           AS sale_discount,
  sr.subtotal                 AS return_subtotal,
  sr.discount_amount          AS return_discount,
  sr.total                    AS return_net_total,
  (SELECT COALESCE(SUM(jel.debit), 0)
   FROM journal_entries je
   JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
   JOIN accounts a ON a.id = jel.account_id AND a.code IN ('4000','4100','4010')
   WHERE je.reference_id = sr.id AND je.reference_type = 'sale_return'
     AND (je.is_void IS NULL OR je.is_void = FALSE)) AS settlement_je_amount,
  (SELECT COUNT(*) FROM journal_entries je
   JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
   JOIN accounts a ON a.id = jel.account_id AND a.code = '1200' AND jel.debit > 0
   WHERE je.reference_id = sr.id AND je.reference_type = 'sale_return'
     AND (je.is_void IS NULL OR je.is_void = FALSE)) AS inv_je_count,
  CASE
    WHEN s.discount_amount > 0 AND sr.discount_amount = 0 THEN 'DISCOUNT MISSING'
    WHEN s.discount_amount > 0 AND sr.discount_amount > 0 THEN 'DISCOUNT OK'
    ELSE 'NO DISCOUNT'
  END AS discount_flag,
  sr.created_at
FROM sale_returns sr
LEFT JOIN sales s ON s.id = sr.original_sale_id
WHERE sr.company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'
ORDER BY sr.created_at DESC;
