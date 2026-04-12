-- =====================================================================
-- REPAIR PLAYBOOK: Sale + Manual Sale Return — Live Data Cases
-- Purpose  : Auditable repair for pre-fix returns missing inventory JE
-- Safety   : All statements are wrapped in explicit transactions.
--            Each block MUST be reviewed before execution.
--            No hard deletes. All repairs add new rows / correct entries.
-- Run on   : Supabase / Postgres (direct SQL only, no app deploy)
-- Date     : 2026-04-12
-- Context  : FINAL_SALE_ENGINE_AND_MANUAL_SALE_RETURN_STANDARDIZATION_CLOSURE
-- =====================================================================

-- !! CRITICAL: Read every block before executing. !!
-- !! Do NOT run this as a single batch.           !!
-- !! Verify CHECK queries return expected results  !!
-- !! before committing any repair block.           !!


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK R1: Identify finalized returns missing inventory reversal JE
-- (Pre-requisite read — run this first to understand what needs repair)
-- ─────────────────────────────────────────────────────────────────────────────

-- Step R1-A: List returns needing the inventory reversal JE.
-- These were finalized before the engine fix (2026-04-12).
-- They already have a settlement JE but lack Dr Inventory / Cr COGS.

WITH existing_inv_je AS (
  SELECT DISTINCT je.reference_id AS return_id
  FROM journal_entries je
  JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
  JOIN accounts a ON a.id = jel.account_id
  WHERE je.reference_type = 'sale_return'
    AND (je.is_void IS NULL OR je.is_void = FALSE)
    AND a.code = '1200'    -- Inventory account
    AND jel.debit > 0
),
return_stock_cost AS (
  SELECT
    reference_id                    AS return_id,
    SUM(total_cost)                 AS total_cost
  FROM stock_movements
  WHERE reference_type = 'sale_return'
    AND movement_type = 'sale_return'
    AND quantity > 0
  GROUP BY reference_id
)
SELECT
  sr.id                   AS return_id,
  sr.company_id,
  sr.branch_id,
  sr.return_no,
  sr.status,
  sr.total                AS selling_total,
  COALESCE(rsc.total_cost, 0) AS cost_basis,
  sr.created_at
FROM sale_returns sr
LEFT JOIN existing_inv_je eij ON eij.return_id = sr.id
LEFT JOIN return_stock_cost rsc ON rsc.return_id = sr.id
WHERE sr.status = 'final'
  AND eij.return_id IS NULL              -- no inventory JE yet
  AND COALESCE(rsc.total_cost, 0) > 0   -- but has stock movements (has a cost basis)
ORDER BY sr.created_at DESC;

-- If this returns 0 rows: no repair needed (all finalized returns already have the JE).
-- If it returns rows: proceed with Block R2 below, one return at a time.


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK R2: Template for posting the missing inventory reversal JE
-- (Parameterized — substitute :return_id, :company_id, :branch_id, :cost_amount)
-- Commit per return.
-- ─────────────────────────────────────────────────────────────────────────────

-- Step R2-A: Verify the target return and cost before running R2-B.
/*
SELECT
  sr.id, sr.return_no, sr.company_id, sr.branch_id, sr.status,
  sm.total_cost
FROM sale_returns sr
JOIN (
  SELECT reference_id, SUM(total_cost) AS total_cost
  FROM stock_movements
  WHERE reference_type = 'sale_return'
    AND movement_type = 'sale_return'
    AND reference_id = '<your_return_id>'
  GROUP BY reference_id
) sm ON sm.reference_id = sr.id
WHERE sr.id = '<your_return_id>';
*/


-- Step R2-B: Post the inventory reversal JE for a single return.
-- SUBSTITUTE: <your_return_id>, <your_company_id>, <your_branch_id>, <cost_amount>
-- VERIFY: inventory_account_id and cogs_account_id below (should be 1200 and 5000).
/*
BEGIN;

-- Confirm accounts exist in this company
SELECT id, code, name FROM accounts
WHERE company_id = '<your_company_id>'
  AND code IN ('1200', '5000')
  AND (is_active IS NULL OR is_active = TRUE);
-- Must return exactly 2 rows.

-- Insert journal entry header
INSERT INTO journal_entries (
  id,
  company_id,
  branch_id,
  entry_no,
  entry_date,
  description,
  reference_type,
  reference_id,
  created_by,
  action_fingerprint,
  is_void
)
SELECT
  gen_random_uuid(),
  '<your_company_id>',
  '<your_branch_id>',    -- set NULL if no branch
  'JE-RTN-INV-REPAIR-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MISS'),
  CURRENT_DATE,
  'Sale Return ' || sr.return_no || ' – Inventory reversal (cost) [REPAIR 2026-04-12]',
  'sale_return',
  sr.id,
  NULL,
  'sale_return_cogs:<your_company_id>:<your_return_id>',
  FALSE
FROM sale_returns sr
WHERE sr.id = '<your_return_id>'
  AND sr.company_id = '<your_company_id>'
  AND sr.status = 'final'
RETURNING id;
-- Note the returned JE id for the next step.

-- Insert Dr Inventory (1200)
INSERT INTO journal_entry_lines (
  id, journal_entry_id, account_id, debit, credit, description
)
SELECT
  gen_random_uuid(),
  je.id,
  inv_acc.id,
  <cost_amount>,   -- substitute with actual cost from R2-A
  0,
  'Inventory returned – ' || sr.return_no || ' [REPAIR]'
FROM journal_entries je
CROSS JOIN (
  SELECT id FROM accounts
  WHERE company_id = '<your_company_id>' AND code = '1200'
  LIMIT 1
) inv_acc
CROSS JOIN sale_returns sr
WHERE je.action_fingerprint = 'sale_return_cogs:<your_company_id>:<your_return_id>'
  AND sr.id = '<your_return_id>';

-- Insert Cr COGS (5000)
INSERT INTO journal_entry_lines (
  id, journal_entry_id, account_id, debit, credit, description
)
SELECT
  gen_random_uuid(),
  je.id,
  cogs_acc.id,
  0,
  <cost_amount>,   -- same amount as above
  'COGS reversal – ' || sr.return_no || ' [REPAIR]'
FROM journal_entries je
CROSS JOIN (
  SELECT id FROM accounts
  WHERE company_id = '<your_company_id>' AND code = '5000'
  LIMIT 1
) cogs_acc
CROSS JOIN sale_returns sr
WHERE je.action_fingerprint = 'sale_return_cogs:<your_company_id>:<your_return_id>'
  AND sr.id = '<your_return_id>';

-- Verify double-entry balance for this JE
SELECT
  je.id AS je_id,
  SUM(jel.debit)  AS total_debit,
  SUM(jel.credit) AS total_credit,
  CASE WHEN SUM(jel.debit) = SUM(jel.credit) THEN 'BALANCED' ELSE 'UNBALANCED' END AS status
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
WHERE je.action_fingerprint = 'sale_return_cogs:<your_company_id>:<your_return_id>'
GROUP BY je.id;
-- Must return 'BALANCED' before committing.

COMMIT;  -- Only commit if verification above shows BALANCED.
-- ROLLBACK;  -- Uncomment to abort instead.
*/


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK R3: Fix sale_return settlement JE that mistakenly Cr'd AP (2000)
-- This would only occur if an old bug routed refund to supplier payable.
-- Check first — if 0 rows returned, skip this block entirely.
-- ─────────────────────────────────────────────────────────────────────────────

-- Step R3-A: Identify any settlement JE lines that Cr AP (wrong routing)
SELECT
  je.id              AS journal_entry_id,
  je.reference_id    AS return_id,
  sr.return_no,
  je.entry_date,
  a.code             AS wrong_credit_code,
  a.name             AS wrong_credit_name,
  jel.credit         AS wrong_credit_amount
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN accounts a ON a.id = jel.account_id
JOIN sale_returns sr ON sr.id = je.reference_id
WHERE je.reference_type = 'sale_return'
  AND (je.is_void IS NULL OR je.is_void = FALSE)
  AND jel.credit > 0
  AND a.code = '2000'    -- Accounts Payable — wrong for sale return settlement
ORDER BY je.entry_date DESC;

-- If 0 rows: skip R3-B entirely.

-- Step R3-B: If AP-credit rows exist, void the bad JE and re-post correctly.
-- (Parameterized — only run if R3-A returns rows)
/*
BEGIN;

-- Void the bad journal entry (sets is_void = TRUE, preserves audit trail)
UPDATE journal_entries
SET
  is_void = TRUE,
  updated_at = NOW()
WHERE id = '<bad_journal_entry_id>'
  AND reference_type = 'sale_return'
  AND (is_void IS NULL OR is_void = FALSE);
-- Verify 1 row affected.

-- Re-post correct settlement JE here:
-- (Use the application's recordSaleReturn function from AccountingContext or
--  manually insert with correct Cr account — 1100 for adjust, 1000 for cash, 1010 for bank)
-- See template in R2-B above for journal insert pattern.

COMMIT;
*/


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK R4: Reclassify sale JE COGS lines on wrong account (if any found in CHECK 1)
-- Only needed if CHECK 1 returns rows with wrong COGS account code.
-- ─────────────────────────────────────────────────────────────────────────────

-- Step R4-A: Count lines with wrong COGS routing
SELECT
  a.code,
  a.name,
  COUNT(*) AS line_count,
  SUM(jel.debit) AS total_debit
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN accounts a ON a.id = jel.account_id
WHERE je.reference_type = 'sale'
  AND (je.is_void IS NULL OR je.is_void = FALSE)
  AND je.payment_id IS NULL
  AND jel.debit > 0
  AND a.code NOT IN ('1100','5200')      -- not AR, not Discount
  AND a.type NOT IN ('revenue','asset','cash','bank','mobile_wallet')
  AND a.code != '5000'                   -- NOT the canonical COGS account
GROUP BY a.code, a.name
ORDER BY a.code;

-- Expected: 0 rows. If any, they represent wrong COGS mapping.
-- Repair: void the affected JE and re-post. Use R2-B template structure.
-- (Do NOT UPDATE journal_entry_lines.account_id — always void + re-post for audit trail)


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK R5: Verify action_fingerprint uniqueness for sale return inventory JEs
-- After repair, each return should have exactly 1 non-voided inventory JE.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  je.reference_id   AS return_id,
  sr.return_no,
  COUNT(*)          AS je_count
FROM journal_entries je
JOIN sale_returns sr ON sr.id = je.reference_id
WHERE je.reference_type = 'sale_return'
  AND (je.is_void IS NULL OR je.is_void = FALSE)
  AND je.action_fingerprint LIKE 'sale_return_cogs:%'
GROUP BY je.reference_id, sr.return_no
HAVING COUNT(*) > 1;

-- Expected: 0 rows. If any return has more than 1 inventory JE, void the duplicates.


-- ─────────────────────────────────────────────────────────────────────────────
-- NOTES
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. New returns finalized AFTER the engine fix (2026-04-12) will automatically
--    get the inventory reversal JE via finalizeSaleReturn → createSaleReturnInventoryReversalJE.
--    Only old pre-fix returns need the R2-B repair.
--
-- 2. voidSaleReturn already reverses ALL JEs with reference_type='sale_return'
--    for a given return. So if a return is voided, both the settlement JE AND
--    the inventory reversal JE will be auto-reversed. No extra repair needed
--    for voids.
--
-- 3. Never hard-delete journal_entries or journal_entry_lines.
--    Always void (is_void = TRUE) + optionally re-post.
--
-- 4. Run all repair SQL against a read replica or dev DB first.
--    Confirm results before running on production.
-- ─────────────────────────────────────────────────────────────────────────────
