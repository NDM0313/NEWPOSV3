-- =====================================================================
-- REPAIR PLAYBOOK: All Sale Return Engine — Comprehensive Live Data Repair
-- Purpose  : Auditable repair for all identified sale return accounting issues
-- Safety   : All statements wrapped in explicit transactions.
--            Each block MUST be reviewed before execution.
--            No hard deletes. All repairs add new rows / void entries.
-- Run on   : Supabase / Postgres (direct SQL only, no app deploy)
-- Date     : 2026-04-12
-- Context  : FINAL_SALE_RETURN_ENGINE_HISTORIC_AUDIT_AND_REPAIR_CLOSURE
-- Prereqs  : Run verify_all_sale_return_engine_consistency.sql first
-- =====================================================================

-- !! CRITICAL: Read every block before executing. !!
-- !! Do NOT run this as a single batch.           !!
-- !! Run on dev/replica first, confirm, then prod.!!
-- !! Verify CHECK queries before committing.      !!


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK A: Backfill action_fingerprint on existing settlement JEs
-- These are JEs created before the idempotency fix (2026-04-12).
-- After backfill, re-submits will deduplicate correctly via the UNIQUE index.
-- ONLY run if you want pre-fix JEs to be protected going forward.
-- ─────────────────────────────────────────────────────────────────────────────

-- Step A-1: Identify settlement JEs missing action_fingerprint
WITH settlement_jes_without_fp AS (
  SELECT
    je.id                AS je_id,
    je.company_id,
    je.reference_id      AS return_id,
    sr.return_no
  FROM journal_entries je
  JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
  JOIN accounts a ON a.id = jel.account_id
    AND a.code IN ('4000','4100','4010')
    AND jel.debit > 0
  JOIN sale_returns sr ON sr.id = je.reference_id
  WHERE je.reference_type = 'sale_return'
    AND (je.is_void IS NULL OR je.is_void = FALSE)
    AND je.action_fingerprint IS NULL
)
SELECT
  je_id,
  return_id,
  return_no,
  company_id,
  'sale_return_settlement:' || company_id || ':' || return_id AS target_fingerprint
FROM settlement_jes_without_fp
ORDER BY return_id;

-- If 0 rows: all settlement JEs already have fingerprints. Skip A-2.
-- If rows returned: verify each return has only 1 such JE before proceeding.

-- Step A-2: Backfill fingerprints (one return at a time in production).
-- WARNING: Only run this if Step A-1 confirms exactly 1 settlement JE per return.
-- If any return shows 2+ JEs, handle via BLOCK B first.
/*
BEGIN;

-- Verify: no return has 2+ settlement JEs without fingerprint
SELECT
  reference_id, COUNT(*) AS je_count
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN accounts a ON a.id = jel.account_id
  AND a.code IN ('4000','4100','4010') AND jel.debit > 0
WHERE je.reference_type = 'sale_return'
  AND (je.is_void IS NULL OR je.is_void = FALSE)
  AND je.action_fingerprint IS NULL
GROUP BY reference_id
HAVING COUNT(*) > 1;
-- Must return 0 rows before continuing.

-- Backfill fingerprints for all clean (single-JE) returns at once:
UPDATE journal_entries je
SET
  action_fingerprint = 'sale_return_settlement:' || je.company_id || ':' || je.reference_id,
  updated_at = NOW()
WHERE je.reference_type = 'sale_return'
  AND (je.is_void IS NULL OR je.is_void = FALSE)
  AND je.action_fingerprint IS NULL
  AND EXISTS (
    SELECT 1 FROM journal_entry_lines jel
    JOIN accounts a ON a.id = jel.account_id
    WHERE jel.journal_entry_id = je.id
      AND a.code IN ('4000','4100','4010')
      AND jel.debit > 0
  );
-- Verify row count matches Step A-1.

COMMIT;
*/


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK B: Void duplicate settlement JEs (keep earliest, void the rest)
-- Only run if CHECK D from verify_all_sale_return_engine_consistency.sql returns rows.
-- ─────────────────────────────────────────────────────────────────────────────

-- Step B-1: Identify duplicates with their JE details
WITH settlement_jes AS (
  SELECT
    je.id              AS je_id,
    je.reference_id    AS return_id,
    sr.return_no,
    je.company_id,
    je.entry_date,
    je.created_at,
    ROW_NUMBER() OVER (
      PARTITION BY je.reference_id
      ORDER BY je.created_at ASC    -- keep earliest
    ) AS rn
  FROM journal_entries je
  JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
  JOIN accounts a ON a.id = jel.account_id
    AND a.code IN ('4000','4100','4010')
    AND jel.debit > 0
  JOIN sale_returns sr ON sr.id = je.reference_id
  WHERE je.reference_type = 'sale_return'
    AND (je.is_void IS NULL OR je.is_void = FALSE)
)
SELECT
  je_id,
  return_id,
  return_no,
  company_id,
  entry_date,
  created_at,
  CASE WHEN rn = 1 THEN 'KEEP (earliest)' ELSE 'VOID (duplicate)' END AS action
FROM settlement_jes
WHERE return_id IN (
  SELECT reference_id
  FROM settlement_jes
  GROUP BY reference_id
  HAVING COUNT(*) > 1
)
ORDER BY return_id, rn;

-- Review the output. Confirm 'KEEP' rows look correct before voiding.

-- Step B-2: Void duplicates (parameterized — run for each duplicate je_id from B-1)
/*
BEGIN;

-- Void a single duplicate settlement JE:
UPDATE journal_entries
SET
  is_void = TRUE,
  updated_at = NOW()
WHERE id = '<duplicate_je_id>'
  AND reference_type = 'sale_return'
  AND (is_void IS NULL OR is_void = FALSE);
-- Verify 1 row affected.

-- Verify the return now has exactly 1 active settlement JE:
SELECT COUNT(DISTINCT je.id) AS remaining_settlement_count
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN accounts a ON a.id = jel.account_id
  AND a.code IN ('4000','4100','4010') AND jel.debit > 0
WHERE je.reference_id = '<your_return_id>'
  AND je.reference_type = 'sale_return'
  AND (je.is_void IS NULL OR je.is_void = FALSE);
-- Must return 1.

COMMIT;
*/


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK C: Post missing inventory reversal JEs (pre-fix returns)
-- Same approach as repair_sale_and_manual_sale_return_live_cases.sql R2-B.
-- Use CHECK B (and CHECK E) output to identify which returns need this.
-- ─────────────────────────────────────────────────────────────────────────────

-- Step C-1: List returns needing the inventory reversal JE (from CHECK B / R1 of prior script)
WITH existing_inv_je AS (
  SELECT DISTINCT je.reference_id AS return_id
  FROM journal_entries je
  JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
  JOIN accounts a ON a.id = jel.account_id
  WHERE je.reference_type = 'sale_return'
    AND (je.is_void IS NULL OR je.is_void = FALSE)
    AND a.code = '1200'
    AND jel.debit > 0
),
return_stock_cost AS (
  SELECT
    reference_id          AS return_id,
    SUM(total_cost)       AS total_cost
  FROM stock_movements
  WHERE reference_type = 'sale_return'
    AND movement_type = 'sale_return'
    AND quantity > 0
  GROUP BY reference_id
)
SELECT
  sr.id               AS return_id,
  sr.company_id,
  sr.branch_id,
  sr.return_no,
  sr.status,
  COALESCE(rsc.total_cost, 0) AS cost_basis,
  sr.created_at
FROM sale_returns sr
LEFT JOIN existing_inv_je eij ON eij.return_id = sr.id
LEFT JOIN return_stock_cost rsc ON rsc.return_id = sr.id
WHERE sr.status = 'final'
  AND eij.return_id IS NULL
  AND COALESCE(rsc.total_cost, 0) > 0
ORDER BY sr.created_at DESC;

-- Step C-2: Post inventory reversal JE for a single return.
-- SUBSTITUTE: <your_return_id>, <your_company_id>, <your_branch_id>, <cost_amount>
/*
BEGIN;

-- Confirm accounts exist
SELECT id, code, name FROM accounts
WHERE company_id = '<your_company_id>'
  AND code IN ('1200','5000')
  AND (is_active IS NULL OR is_active = TRUE);
-- Must return exactly 2 rows.

-- Insert journal entry header
INSERT INTO journal_entries (
  id, company_id, branch_id, entry_no, entry_date, description,
  reference_type, reference_id, created_by, action_fingerprint, is_void
)
SELECT
  gen_random_uuid(),
  '<your_company_id>',
  '<your_branch_id>',   -- NULL if no branch
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
-- Note the returned JE id.

-- Insert Dr Inventory (1200)
INSERT INTO journal_entry_lines (id, journal_entry_id, account_id, debit, credit, description)
SELECT
  gen_random_uuid(),
  je.id,
  inv_acc.id,
  <cost_amount>,   -- from C-1 cost_basis column
  0,
  'Inventory returned – ' || sr.return_no || ' [REPAIR]'
FROM journal_entries je
CROSS JOIN (SELECT id FROM accounts WHERE company_id = '<your_company_id>' AND code = '1200' LIMIT 1) inv_acc
CROSS JOIN sale_returns sr
WHERE je.action_fingerprint = 'sale_return_cogs:<your_company_id>:<your_return_id>'
  AND sr.id = '<your_return_id>';

-- Insert Cr COGS (5000)
INSERT INTO journal_entry_lines (id, journal_entry_id, account_id, debit, credit, description)
SELECT
  gen_random_uuid(),
  je.id,
  cogs_acc.id,
  0,
  <cost_amount>,   -- same amount
  'COGS reversal – ' || sr.return_no || ' [REPAIR]'
FROM journal_entries je
CROSS JOIN (SELECT id FROM accounts WHERE company_id = '<your_company_id>' AND code = '5000' LIMIT 1) cogs_acc
CROSS JOIN sale_returns sr
WHERE je.action_fingerprint = 'sale_return_cogs:<your_company_id>:<your_return_id>'
  AND sr.id = '<your_return_id>';

-- Verify balance
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

COMMIT;
*/


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK D: Fix wrong credit routing in settlement JEs (AP or wrong account)
-- Only run if CHECK F from verify_all_sale_return_engine_consistency.sql returns rows.
-- ─────────────────────────────────────────────────────────────────────────────

-- Step D-1: Identify JEs with wrong credit routing (mirrors CHECK F)
SELECT
  je.id              AS journal_entry_id,
  je.reference_id    AS return_id,
  sr.return_no,
  je.entry_date,
  a.code             AS wrong_credit_code,
  a.name             AS wrong_credit_name,
  jel.credit         AS amount
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN accounts a ON a.id = jel.account_id
JOIN sale_returns sr ON sr.id = je.reference_id
WHERE je.reference_type = 'sale_return'
  AND (je.is_void IS NULL OR je.is_void = FALSE)
  AND jel.credit > 0
  AND a.code NOT IN ('1100','1000','1010','1020','1200','5000')
  AND a.code NOT LIKE '1%'
ORDER BY je.entry_date DESC;

-- Step D-2: Void the bad JE and re-post correctly (manual post required after void).
-- Parameterized — only run if D-1 returns rows.
/*
BEGIN;

-- Void the bad settlement JE
UPDATE journal_entries
SET
  is_void = TRUE,
  updated_at = NOW()
WHERE id = '<bad_journal_entry_id>'
  AND reference_type = 'sale_return'
  AND (is_void IS NULL OR is_void = FALSE);
-- Verify 1 row affected.

-- After committing: re-post the correct settlement JE via the application's recordSaleReturn
-- OR insert manually using the structure from BLOCK C-2 above, with correct credit account:
--   '1100' for adjust-in-account, '1000' for cash, '1010' for bank.

COMMIT;
*/


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK E: Post missing settlement + inventory JEs for returns with no JEs at all
-- Only run if CHECK G from verify_all_sale_return_engine_consistency.sql returns rows.
-- These returns had a complete accounting failure on finalization.
-- ─────────────────────────────────────────────────────────────────────────────

-- These require BOTH JEs:
-- 1. Settlement JE (Dr Revenue / Cr AR or Cash/Bank) — must be posted manually via app or SQL
-- 2. Inventory reversal JE — use BLOCK C-2 template above

-- For each return from CHECK G:
-- Step 1: Determine refund method used (check sale_returns.notes or ask user)
-- Step 2: Post settlement JE (Dr 4000 / Cr appropriate account)
-- Step 3: Post inventory reversal JE (BLOCK C-2 template)
-- Step 4: Run CHECK G again — must return 0 rows for that return.


-- ─────────────────────────────────────────────────────────────────────────────
-- POST-REPAIR VERIFICATION
-- Run after all repair blocks to confirm clean state.
-- ─────────────────────────────────────────────────────────────────────────────

-- V1: No duplicate settlement JEs (CHECK D should return 0)
SELECT COUNT(*) AS duplicate_settlement_returns
FROM (
  SELECT je.reference_id
  FROM journal_entries je
  JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
  JOIN accounts a ON a.id = jel.account_id
    AND a.code IN ('4000','4100','4010') AND jel.debit > 0
  WHERE je.reference_type = 'sale_return'
    AND (je.is_void IS NULL OR je.is_void = FALSE)
  GROUP BY je.reference_id
  HAVING COUNT(DISTINCT je.id) > 1
) dup;
-- Expected: 0.

-- V2: No returns missing inventory JE (CHECK B should return 0 non-zero-cost missing rows)
WITH stock_costs AS (
  SELECT reference_id AS return_id, SUM(total_cost) AS total_cost
  FROM stock_movements
  WHERE reference_type = 'sale_return' AND movement_type = 'sale_return' AND quantity > 0
  GROUP BY reference_id
)
SELECT COUNT(*) AS returns_missing_inv_je
FROM sale_returns sr
JOIN stock_costs sc ON sc.return_id = sr.id AND sc.total_cost > 0
LEFT JOIN (
  SELECT DISTINCT je.reference_id AS return_id
  FROM journal_entries je
  JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
  JOIN accounts a ON a.id = jel.account_id AND a.code = '1200' AND jel.debit > 0
  WHERE je.reference_type = 'sale_return' AND (je.is_void IS NULL OR je.is_void = FALSE)
) inv ON inv.return_id = sr.id
WHERE sr.status = 'final' AND inv.return_id IS NULL;
-- Expected: 0 (or the known count of pre-fix returns that haven't been repaired yet).

-- V3: No wrong credit routing (CHECK F should return 0)
SELECT COUNT(*) AS wrong_routing_count
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN accounts a ON a.id = jel.account_id
WHERE je.reference_type = 'sale_return'
  AND (je.is_void IS NULL OR je.is_void = FALSE)
  AND jel.credit > 0
  AND a.code NOT IN ('1100','1000','1010','1020','1200','5000')
  AND a.code NOT LIKE '1%';
-- Expected: 0.


-- ─────────────────────────────────────────────────────────────────────────────
-- NOTES
-- 1. All blocks produce a complete audit trail: void + re-post, never direct edit.
-- 2. action_fingerprint backfill (BLOCK A) is optional for pre-fix JEs — the DB
--    index only deduplicates future writes; backfilling protects against manual
--    re-submits of old returns.
-- 3. voidSaleReturn auto-reverses ALL reference_type='sale_return' JEs for a
--    given return_id. No extra repair needed for voided returns.
-- 4. For BLOCK C, always run the balance check (BALANCED) before COMMIT.
-- 5. Never hard-delete journal_entries or journal_entry_lines.
-- ─────────────────────────────────────────────────────────────────────────────
