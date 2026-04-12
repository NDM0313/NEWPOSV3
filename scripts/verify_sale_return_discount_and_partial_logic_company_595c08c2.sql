-- =====================================================================
-- VERIFICATION: Sale Return Discount & Partial-Quantity Logic
-- Purpose  : Comprehensive read-only audit of discount allocation and
--            partial quantity correctness for all sale returns.
-- Safe     : All SELECT only. No modifications.
-- Company  : 595c08c2-1e47-4581-89c9-1f78de51c613
-- Date     : 2026-04-12
-- Context  : FINAL_COMPANY_595C08C2_SALE_ENGINE_FULL_AUDIT_AND_REPAIR
-- =====================================================================

-- Canonical rule:
--   returnDiscount = sale.discount_amount × (returnSubtotal / sale.subtotal)
--   returnTotal    = returnSubtotal - returnDiscount
--   settlementJE   = returnTotal (must match exactly)
--   inventoryJE    = Σ(returnQty × stockMovement.unit_cost) from original sale stock movements

-- ─── CHECK 1 ─────────────────────────────────────────────────────────────────
-- Returns where discount_amount = 0 but original sale had a discount.
-- These have INFLATED settlement JEs (gross instead of net).
-- Expected post-fix: 0 rows.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  sr.id            AS return_id,
  sr.return_no,
  sr.status,
  sr.subtotal      AS return_subtotal,
  sr.discount_amount AS return_discount,
  sr.total         AS return_total,
  s.invoice_no,
  s.customer_name,
  s.subtotal       AS sale_subtotal,
  s.discount_amount AS sale_discount,
  s.total          AS sale_total,
  -- What the return total SHOULD be (if fully returning):
  ROUND((s.discount_amount / NULLIF(s.subtotal, 0) * sr.subtotal)::NUMERIC, 2) AS correct_proportional_discount,
  ROUND((sr.subtotal - s.discount_amount / NULLIF(s.subtotal, 0) * sr.subtotal)::NUMERIC, 2) AS correct_return_total,
  -- Overcharge: what the settlement JE debits extra
  ROUND((sr.subtotal - (sr.subtotal - s.discount_amount / NULLIF(s.subtotal, 0) * sr.subtotal))::NUMERIC, 2) AS overcharge_vs_correct,
  sr.created_at
FROM sale_returns sr
JOIN sales s ON s.id = sr.original_sale_id
WHERE sr.company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'
  AND sr.status = 'final'
  AND s.discount_amount > 0
  AND sr.discount_amount = 0
ORDER BY sr.created_at DESC;

-- Expected: 0 rows after DB repair.

-- ─── CHECK 2 ─────────────────────────────────────────────────────────────────
-- Proportional discount accuracy for returns that DO have a discount set.
-- The discount rate must match the original sale's discount rate within 0.1%.
-- Expected: 0 rows (all discounts are proportional).
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  sr.return_no,
  sr.subtotal                  AS return_subtotal,
  sr.discount_amount           AS return_discount,
  s.subtotal                   AS sale_subtotal,
  s.discount_amount            AS sale_discount,
  ROUND((s.discount_amount / NULLIF(s.subtotal, 0) * 100)::NUMERIC, 4) AS sale_rate_pct,
  ROUND((sr.discount_amount / NULLIF(sr.subtotal, 0) * 100)::NUMERIC, 4) AS return_rate_pct,
  ABS(
    COALESCE(sr.discount_amount / NULLIF(sr.subtotal, 0), 0) -
    COALESCE(s.discount_amount / NULLIF(s.subtotal, 0), 0)
  )                            AS rate_diff,
  CASE
    WHEN ABS(
      COALESCE(sr.discount_amount / NULLIF(sr.subtotal, 0), 0) -
      COALESCE(s.discount_amount / NULLIF(s.subtotal, 0), 0)
    ) > 0.001 THEN 'RATE MISMATCH — discount not proportional'
    ELSE 'OK'
  END AS status
FROM sale_returns sr
JOIN sales s ON s.id = sr.original_sale_id
WHERE sr.company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'
  AND sr.status = 'final'
  AND s.discount_amount > 0
  AND sr.discount_amount > 0
ORDER BY rate_diff DESC;

-- ─── CHECK 3 ─────────────────────────────────────────────────────────────────
-- Partial quantity return item totals.
-- For partial returns, item.total must equal qty/orig_qty × orig_line_total.
-- Expected: 0 rows with discrepancy > 0.01.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  sr.return_no,
  sr.status,
  sri.product_id,
  sri.quantity                 AS return_qty,
  si.quantity                  AS orig_qty,
  sri.unit_price               AS return_unit_price,
  si.unit_price                AS orig_unit_price,
  sri.total                    AS return_item_total,
  si.total                     AS orig_line_total,
  ROUND((sri.quantity / NULLIF(si.quantity, 0) * si.total)::NUMERIC, 2) AS expected_item_total,
  ABS(sri.total - (sri.quantity / NULLIF(si.quantity, 0) * si.total)) AS item_discrepancy,
  CASE
    WHEN ABS(sri.total - (sri.quantity / NULLIF(si.quantity, 0) * si.total)) < 0.01
      THEN 'OK — proportional'
    ELSE 'DISCREPANCY — not proportional to original line'
  END AS status
FROM sale_returns sr
JOIN sale_return_items sri ON sri.sale_return_id = sr.id
JOIN sales_items si ON si.id = sri.sale_item_id
WHERE sr.company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'
  AND sri.quantity < si.quantity  -- partial returns only
  AND sr.status = 'final'
ORDER BY item_discrepancy DESC;

-- ─── CHECK 4 ─────────────────────────────────────────────────────────────────
-- Settlement JE debit amount MUST equal sale_return.total exactly.
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
    WHEN SUM(jel.debit) > sr.total             THEN 'JE > net total — INFLATED (gross bug)'
    ELSE                                             'JE < net total — UNDER-POSTED'
  END AS status
FROM sale_returns sr
JOIN journal_entries je ON je.reference_id = sr.id AND je.reference_type = 'sale_return'
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN accounts a ON a.id = jel.account_id AND a.code IN ('4000','4100','4010')
WHERE sr.company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'
  AND sr.status = 'final'
  AND (je.is_void IS NULL OR je.is_void = FALSE)
GROUP BY sr.return_no, sr.total, sr.discount_amount, je.id, je.action_fingerprint
HAVING ABS(SUM(jel.debit) - sr.total) > 0.01
ORDER BY discrepancy DESC;

-- Expected: 0 rows after repair.

-- ─── CHECK 5 ─────────────────────────────────────────────────────────────────
-- Inventory reversal JE amounts vs stock_movements.total_cost (cost basis).
-- The inventory JE (Dr 1200 / Cr 5000) should equal the sum of
-- stock_movements.total_cost for the return (not the selling price).
-- ─────────────────────────────────────────────────────────────────────────────
WITH return_stock_cost AS (
  SELECT reference_id AS return_id, SUM(total_cost) AS stock_total_cost
  FROM stock_movements
  WHERE reference_type = 'sale_return' AND movement_type = 'sale_return' AND quantity > 0
  GROUP BY reference_id
),
return_je_inv AS (
  SELECT je.reference_id AS return_id, SUM(jel.debit) AS je_inventory_debit
  FROM journal_entries je
  JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
  JOIN accounts a ON a.id = jel.account_id AND a.code = '1200' AND jel.debit > 0
  WHERE je.reference_type = 'sale_return' AND (je.is_void IS NULL OR je.is_void = FALSE)
  GROUP BY je.reference_id
)
SELECT
  sr.return_no,
  sr.status,
  rsc.stock_total_cost,
  COALESCE(rji.je_inventory_debit, 0) AS je_inventory_debit,
  ABS(rsc.stock_total_cost - COALESCE(rji.je_inventory_debit, 0)) AS discrepancy,
  CASE
    WHEN rji.je_inventory_debit IS NULL       THEN 'MISSING inventory JE'
    WHEN ABS(rsc.stock_total_cost - rji.je_inventory_debit) > 0.01 THEN 'AMOUNT MISMATCH'
    ELSE 'OK'
  END AS status
FROM return_stock_cost rsc
JOIN sale_returns sr ON sr.id = rsc.return_id
LEFT JOIN return_je_inv rji ON rji.return_id = rsc.return_id
WHERE sr.company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'
  AND sr.status = 'final'
ORDER BY discrepancy DESC NULLS FIRST;

-- ─── CHECK 6 ─────────────────────────────────────────────────────────────────
-- Standalone returns — no original_sale_id. These cannot use proportional discount.
-- Show their totals and settlement JE amounts.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  sr.return_no,
  sr.status,
  sr.subtotal,
  sr.discount_amount,
  sr.total,
  (SELECT COALESCE(SUM(jel.debit), 0)
   FROM journal_entries je
   JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
   JOIN accounts a ON a.id = jel.account_id AND a.code IN ('4000','4100','4010')
   WHERE je.reference_id = sr.id AND je.reference_type = 'sale_return'
     AND (je.is_void IS NULL OR je.is_void = FALSE)) AS settlement_je_amount,
  sr.created_at
FROM sale_returns sr
WHERE sr.company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'
  AND sr.original_sale_id IS NULL
ORDER BY sr.created_at DESC;
