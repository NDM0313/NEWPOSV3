-- =====================================================================
-- VERIFICATION: Sale + Manual Sale Return Standardization
-- Purpose  : Read-only audit of sale-side accounting correctness
-- Safe     : All SELECT only. No modifications.
-- Run on   : Supabase / Postgres (direct or via SQL console)
-- Date     : 2026-04-12
-- Context  : FINAL_SALE_ENGINE_AND_MANUAL_SALE_RETURN_STANDARDIZATION_CLOSURE
-- =====================================================================


-- ─── SECTION 0: Reference — canonical account codes ──────────────────────────
-- 1100 = Accounts Receivable (AR)
-- 1200 = Inventory (asset)
-- 4000 or 4100 = Sales Revenue
-- 5000 = Cost of Production (canonical COGS)
-- 5200 = Discount Allowed
-- 4110 = Shipping Income
-- 1000/1010/1020 = Cash / Bank / Mobile Wallet


-- ─── CHECK 1 ─────────────────────────────────────────────────────────────────
-- Sale document JEs: verify COGS line is on account 5000 (not a wrong mapping).
-- Expected: every sale JE with a COGS debit should use code '5000'.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  je.id                       AS journal_entry_id,
  je.company_id,
  je.reference_id             AS sale_id,
  je.entry_no,
  je.entry_date,
  a.code                      AS cogs_account_code,
  a.name                      AS cogs_account_name,
  a.type                      AS cogs_account_type,
  jel.debit                   AS cogs_debit_amount,
  jel.description             AS line_description
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN accounts a ON a.id = jel.account_id
WHERE je.reference_type = 'sale'
  AND (je.is_void IS NULL OR je.is_void = FALSE)
  AND je.payment_id IS NULL          -- document JE only (not payment rows)
  AND jel.debit > 0
  AND jel.credit = 0
  AND a.type NOT IN ('asset', 'cash', 'bank', 'mobile_wallet') -- exclude AR / liquidity
  AND a.code != '5200'                -- exclude Discount Allowed
  AND a.type NOT IN ('revenue')       -- exclude revenue accounts
ORDER BY je.entry_date DESC
LIMIT 100;

-- Expected result: All rows should show code='5000', name like 'Cost of Production'.
-- If ANY row shows a code OTHER than 5000 on a non-AR debit, that is a wrong COGS mapping.


-- ─── CHECK 2 ─────────────────────────────────────────────────────────────────
-- Verify sale JEs have both sides:
-- Debit side: AR (1100) + optional Discount Allowed (5200)
-- Credit side: Sales Revenue (4000/4100) + optional Shipping Income (4110)
-- Plus COGS pair: Dr 5000 / Cr 1200
-- ─────────────────────────────────────────────────────────────────────────────
WITH sale_je_summary AS (
  SELECT
    je.id                     AS je_id,
    je.reference_id           AS sale_id,
    je.entry_date,
    BOOL_OR(a.code IN ('1100') AND jel.debit > 0)           AS has_ar_debit,
    BOOL_OR(a.code IN ('4000','4100','4010') AND jel.credit > 0) AS has_revenue_credit,
    BOOL_OR(a.code = '5000' AND jel.debit > 0)              AS has_cogs_debit,
    BOOL_OR(a.code = '1200' AND jel.credit > 0)             AS has_inventory_credit,
    COUNT(*) FILTER (WHERE a.code IN ('1100'))               AS ar_line_count,
    SUM(jel.debit) FILTER (WHERE a.code = '1100')           AS ar_debit_total,
    SUM(jel.credit) FILTER (WHERE a.code IN ('4000','4100','4010')) AS revenue_credit_total,
    SUM(jel.debit) FILTER (WHERE a.code = '5000')           AS cogs_debit_total,
    SUM(jel.credit) FILTER (WHERE a.code = '1200')          AS inventory_credit_total
  FROM journal_entries je
  JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
  JOIN accounts a ON a.id = jel.account_id
  WHERE je.reference_type = 'sale'
    AND (je.is_void IS NULL OR je.is_void = FALSE)
    AND je.payment_id IS NULL
  GROUP BY je.id, je.reference_id, je.entry_date
)
SELECT *,
  CASE
    WHEN NOT has_ar_debit      THEN 'MISSING AR debit'
    WHEN NOT has_revenue_credit THEN 'MISSING Revenue credit'
    WHEN NOT has_cogs_debit    THEN 'MISSING COGS debit (5000) — inventory not costed'
    WHEN NOT has_inventory_credit THEN 'MISSING Inventory credit (1200)'
    ELSE 'OK'
  END AS diagnosis
FROM sale_je_summary
WHERE NOT (has_ar_debit AND has_revenue_credit AND has_cogs_debit AND has_inventory_credit)
ORDER BY entry_date DESC
LIMIT 100;


-- ─── CHECK 3 ─────────────────────────────────────────────────────────────────
-- Finalized sale returns: check which ones are MISSING the inventory reversal JE.
-- After the engine fix, finalizeSaleReturn posts both:
--   (A) Settlement JE via AccountingContext.recordSaleReturn (Dr Revenue / Cr AR or Cash)
--   (B) Inventory reversal JE via saleAccountingService (Dr Inventory / Cr COGS)
-- Returns that were finalized BEFORE the fix will only have JE (A) but not (B).
-- ─────────────────────────────────────────────────────────────────────────────
WITH return_je_summary AS (
  SELECT
    sr.id                        AS return_id,
    sr.return_no,
    sr.company_id,
    sr.status,
    sr.total                     AS return_total,
    sr.original_sale_id,
    sr.created_at,
    -- Check if a settlement JE exists (Dr Revenue / Cr AR or Cash/Bank)
    BOOL_OR(
      je.reference_type = 'sale_return' AND jel.debit > 0 AND
      a.code IN ('4000','4100','4010')
    )                            AS has_revenue_debit_je,
    -- Check if an inventory reversal JE exists (Dr Inventory / Cr COGS)
    BOOL_OR(
      je.reference_type = 'sale_return' AND jel.debit > 0 AND
      a.code = '1200'
    )                            AS has_inventory_debit_je,
    BOOL_OR(
      je.reference_type = 'sale_return' AND jel.credit > 0 AND
      a.code = '5000'
    )                            AS has_cogs_credit_je
  FROM sale_returns sr
  LEFT JOIN journal_entries je
    ON je.reference_id = sr.id
    AND je.reference_type = 'sale_return'
    AND (je.is_void IS NULL OR je.is_void = FALSE)
  LEFT JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
  LEFT JOIN accounts a ON a.id = jel.account_id
  WHERE sr.status = 'final'
  GROUP BY sr.id, sr.return_no, sr.company_id, sr.status, sr.total,
           sr.original_sale_id, sr.created_at
)
SELECT
  return_id,
  return_no,
  company_id,
  return_total,
  CASE WHEN original_sale_id IS NULL THEN 'standalone (no invoice)' ELSE 'linked' END AS return_type,
  has_revenue_debit_je,
  has_inventory_debit_je,
  has_cogs_credit_je,
  CASE
    WHEN NOT has_revenue_debit_je AND NOT has_inventory_debit_je THEN 'NO ACCOUNTING JEs AT ALL'
    WHEN has_revenue_debit_je AND NOT has_inventory_debit_je     THEN 'MISSING inventory reversal JE (pre-fix return)'
    WHEN NOT has_revenue_debit_je AND has_inventory_debit_je     THEN 'MISSING settlement JE (unusual)'
    ELSE 'COMPLETE'
  END AS diagnosis,
  created_at
FROM return_je_summary
ORDER BY
  CASE WHEN NOT has_inventory_debit_je THEN 0 ELSE 1 END,
  created_at DESC
LIMIT 200;


-- ─── CHECK 4 ─────────────────────────────────────────────────────────────────
-- Manual sale returns (standalone, no invoice): verify they use customer contacts,
-- not supplier contacts. Check contact type via contacts table join.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  sr.id          AS return_id,
  sr.return_no,
  sr.company_id,
  sr.customer_id,
  sr.customer_name,
  c.type         AS contact_type,
  sr.total,
  sr.created_at
FROM sale_returns sr
LEFT JOIN contacts c ON c.id = sr.customer_id
WHERE sr.original_sale_id IS NULL      -- standalone only
  AND sr.status = 'final'
  AND c.type IS NOT NULL
  AND c.type NOT IN ('customer','walk-in','')  -- non-customer contacts are suspicious
ORDER BY sr.created_at DESC
LIMIT 50;

-- Expected: 0 rows. Any rows here means a sale return was linked to a non-customer contact.


-- ─── CHECK 5 ─────────────────────────────────────────────────────────────────
-- Sale return stock vs JE amount consistency.
-- Compare stock_movements.total_cost vs journal_entry_lines inventory debit
-- for returns that have BOTH (post-fix).
-- ─────────────────────────────────────────────────────────────────────────────
WITH return_stock_cost AS (
  SELECT
    reference_id      AS return_id,
    SUM(total_cost)   AS stock_total_cost
  FROM stock_movements
  WHERE reference_type = 'sale_return'
    AND movement_type = 'sale_return'
    AND quantity > 0
  GROUP BY reference_id
),
return_je_inv AS (
  SELECT
    je.reference_id   AS return_id,
    SUM(jel.debit)    AS je_inventory_debit
  FROM journal_entries je
  JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
  JOIN accounts a ON a.id = jel.account_id
  WHERE je.reference_type = 'sale_return'
    AND (je.is_void IS NULL OR je.is_void = FALSE)
    AND a.code = '1200'
    AND jel.debit > 0
  GROUP BY je.reference_id
)
SELECT
  rsc.return_id,
  sr.return_no,
  sr.total          AS return_selling_total,
  rsc.stock_total_cost,
  rji.je_inventory_debit,
  ABS(rsc.stock_total_cost - COALESCE(rji.je_inventory_debit, 0)) AS discrepancy,
  CASE
    WHEN rji.je_inventory_debit IS NULL THEN 'MISSING inventory JE (pre-fix return)'
    WHEN ABS(rsc.stock_total_cost - rji.je_inventory_debit) > 0.01 THEN 'AMOUNT MISMATCH'
    ELSE 'OK'
  END AS status
FROM return_stock_cost rsc
JOIN sale_returns sr ON sr.id = rsc.return_id
LEFT JOIN return_je_inv rji ON rji.return_id = rsc.return_id
WHERE sr.status = 'final'
ORDER BY
  CASE WHEN rji.je_inventory_debit IS NULL THEN 0
       WHEN ABS(rsc.stock_total_cost - COALESCE(rji.je_inventory_debit, 0)) > 0.01 THEN 1
       ELSE 2 END,
  sr.created_at DESC
LIMIT 100;


-- ─── CHECK 6 ─────────────────────────────────────────────────────────────────
-- Source-owned journal rows: verify sale + sale_return rows are not exposed
-- for direct amount edit from accounting (no direct edit rows should exist
-- post-fix with the correct reference_type tags).
-- Informational only — shows all active non-voided sale + sale_return JEs.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  je.reference_type,
  COUNT(*)                              AS journal_entry_count,
  SUM(jel.debit)                        AS total_debit,
  SUM(jel.credit)                       AS total_credit,
  MIN(je.entry_date)                    AS earliest,
  MAX(je.entry_date)                    AS latest
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
WHERE je.reference_type IN ('sale','sale_return','sale_reversal','sale_adjustment')
  AND (je.is_void IS NULL OR je.is_void = FALSE)
GROUP BY je.reference_type
ORDER BY je.reference_type;

-- All of these reference_types are blocked from direct edit / reversal by
-- resolveUnifiedJournalEdit() in unifiedTransactionEdit.ts.
-- No additional DB enforcement needed — it is code-level source-owned policy.


-- ─── CHECK 7 ─────────────────────────────────────────────────────────────────
-- Settlement JE routing for sale returns:
-- Dr Sales Revenue (4000/4100) / Cr AR (1100) or Cash (1000) or Bank (1010)
-- Verify no settlement JEs mistakenly Cr a supplier-side account (2000 AP).
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  je.id              AS journal_entry_id,
  je.reference_id    AS return_id,
  je.entry_date,
  a.code             AS credit_account_code,
  a.name             AS credit_account_name,
  a.type             AS credit_account_type,
  jel.credit
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN accounts a ON a.id = jel.account_id
WHERE je.reference_type = 'sale_return'
  AND (je.is_void IS NULL OR je.is_void = FALSE)
  AND jel.credit > 0
  AND a.code NOT IN ('1100','1000','1010','1020','1200') -- known valid credit accounts
  AND a.code NOT LIKE '1%'    -- exclude all asset accounts
ORDER BY je.entry_date DESC
LIMIT 50;

-- Expected: 0 rows. Any Cr to AP (2000), expense accounts, or unrelated accounts is wrong routing.


-- ─── SUMMARY ─────────────────────────────────────────────────────────────────
-- Run checks above to identify:
--   CHECK 1 & 2  → Sale JE account mapping validation (5000 for COGS, 1200 for inventory)
--   CHECK 3      → Finalized returns missing the new inventory reversal JE
--   CHECK 4      → Manual returns linked to non-customer contacts (supplier contamination)
--   CHECK 5      → Stock cost vs GL inventory amount discrepancy
--   CHECK 6      → Source-owned JE count (informational)
--   CHECK 7      → Wrong credit routing in settlement JEs
-- ─────────────────────────────────────────────────────────────────────────────
