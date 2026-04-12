-- =====================================================================
-- REPAIR: Purchase Return Missing Journal Entries (P1-1)
-- Purpose : Post missing settlement JEs for all final purchase returns
--           that have no active journal_entries row.
-- Date    : 2026-04-12
-- Context : 25_ACCOUNTING_ARCHITECTURE_FREEZE / 28_P1_PURCHASE_RETURN_GL_GAP_FIX
-- Run on  : Supabase / Postgres via:
--           docker exec supabase-db psql -U postgres -d postgres
-- =====================================================================
-- Scope: all companies (remove the company_id filter to limit to one)
-- =====================================================================

-- ─── PRE-REPAIR: List all final purchase returns without a settlement JE ──────
-- Run first to see what needs repair.
SELECT
  pr.company_id,
  pr.id AS return_id,
  pr.return_no,
  pr.status,
  pr.total AS return_total,
  pr.supplier_id,
  pr.created_at
FROM purchase_returns pr
WHERE pr.status = 'final'
  AND NOT EXISTS (
    SELECT 1
    FROM journal_entries je
    WHERE je.reference_id   = pr.id
      AND je.reference_type = 'purchase_return'
      AND (je.is_void IS NULL OR je.is_void = FALSE)
  )
ORDER BY pr.company_id, pr.created_at;

-- ─── CHECK 1: Count per company ───────────────────────────────────────────────
SELECT
  pr.company_id,
  COUNT(*) AS returns_without_je,
  SUM(pr.total) AS total_unposted_amount
FROM purchase_returns pr
WHERE pr.status = 'final'
  AND NOT EXISTS (
    SELECT 1
    FROM journal_entries je
    WHERE je.reference_id   = pr.id
      AND je.reference_type = 'purchase_return'
      AND (je.is_void IS NULL OR je.is_void = FALSE)
  )
GROUP BY pr.company_id
ORDER BY pr.company_id;

-- ─── CHECK 2: AP account lookup per company ───────────────────────────────────
-- Use this to identify the AP account IDs for each company before posting JEs.
SELECT
  a.company_id,
  a.id AS account_id,
  a.code,
  a.name,
  a.type
FROM accounts a
WHERE a.code IN ('2000', '2100')
  AND a.is_active = TRUE
ORDER BY a.company_id, a.code;

-- ─── CHECK 3: Inventory account lookup per company ───────────────────────────
SELECT
  a.company_id,
  a.id AS account_id,
  a.code,
  a.name,
  a.type
FROM accounts a
WHERE a.code IN ('1200', '1500')
  AND a.is_active = TRUE
ORDER BY a.company_id, a.code;

-- ─── BLOCK A: Template — Post one corrected JE per affected return ─────────────
-- Replace <return_id>, <company_id>, <branch_id>, <return_no>, <return_total>,
-- <ap_account_id>, <inv_account_id> with actual values from the pre-repair query.
-- Run one block per return. Wrap in BEGIN/COMMIT.

/*
BEGIN;
WITH new_je AS (
  INSERT INTO journal_entries (
    company_id, branch_id, entry_date, description,
    reference_id, reference_type,
    action_fingerprint, is_void, created_by
  ) VALUES (
    '<company_id>',
    '<branch_id>',   -- or NULL if no branch
    '<return_date>', -- ISO date: YYYY-MM-DD
    'Purchase Return Settlement (P1-1 repair): <return_no>',
    '<return_id>',
    'purchase_return',
    'purchase_return_settlement:<company_id>:<return_id>',
    FALSE,
    NULL
  )
  RETURNING id
)
INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
VALUES
  ((SELECT id FROM new_je), '<ap_account_id>',  'Purchase Return — AP reversal',   <return_total>, 0),
  ((SELECT id FROM new_je), '<inv_account_id>', 'Purchase Return — Inventory out',  0, <return_total>);
COMMIT;
*/

-- ─── POST-REPAIR VERIFICATION ─────────────────────────────────────────────────

-- Verify 1: No remaining final returns without a settlement JE
SELECT COUNT(*) AS should_be_zero
FROM purchase_returns pr
WHERE pr.status = 'final'
  AND NOT EXISTS (
    SELECT 1
    FROM journal_entries je
    WHERE je.reference_id   = pr.id
      AND je.reference_type = 'purchase_return'
      AND (je.is_void IS NULL OR je.is_void = FALSE)
  );

-- Verify 2: JE debit (AP reversal) matches return.total per return
SELECT
  pr.return_no,
  pr.total AS return_total,
  SUM(jel.debit) AS je_debit,
  ABS(SUM(jel.debit) - pr.total) AS discrepancy
FROM purchase_returns pr
JOIN journal_entries je
  ON je.reference_id   = pr.id
  AND je.reference_type = 'purchase_return'
  AND (je.is_void IS NULL OR je.is_void = FALSE)
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id AND jel.debit > 0
JOIN accounts a ON a.id = jel.account_id AND a.code IN ('2000','2100','2010')
WHERE pr.status = 'final'
GROUP BY pr.return_no, pr.total
ORDER BY discrepancy DESC;

-- Expected: all discrepancy < 0.01.

-- Verify 3: Inventory credit matches return.total per return
SELECT
  pr.return_no,
  pr.total AS return_total,
  SUM(jel.credit) AS je_credit,
  ABS(SUM(jel.credit) - pr.total) AS discrepancy
FROM purchase_returns pr
JOIN journal_entries je
  ON je.reference_id   = pr.id
  AND je.reference_type = 'purchase_return'
  AND (je.is_void IS NULL OR je.is_void = FALSE)
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id AND jel.credit > 0
JOIN accounts a ON a.id = jel.account_id AND a.code IN ('1200','1500')
WHERE pr.status = 'final'
GROUP BY pr.return_no, pr.total
ORDER BY discrepancy DESC;

-- Expected: all discrepancy < 0.01.
