-- ============================================================================
-- FIX EXPENSE JOURNAL IMBALANCE (repair missing credit lines)
-- Run in Supabase SQL Editor. Company-scoped optional.
-- Inserts missing CREDIT lines so each expense entry balances (debit = credit).
-- ============================================================================

-- 1) Preview: entries with imbalance (expense-related)
SELECT
  je.id,
  je.company_id,
  je.entry_no,
  je.entry_date,
  je.reference_type,
  SUM(jel.debit) AS total_debit,
  SUM(jel.credit) AS total_credit,
  (SUM(jel.debit) - SUM(jel.credit)) AS imbalance
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
WHERE je.reference_type = 'expense'
   OR je.entry_no ~ '^EXP-[0-9]+$'
GROUP BY je.id, je.company_id, je.entry_no, je.entry_date, je.reference_type
HAVING ABS(SUM(jel.debit) - SUM(jel.credit)) > 0.01;

-- 2) Repair: insert missing credit line (Cash 1000) for each imbalanced expense entry
-- Uncomment and run after reviewing preview. Replace company_id filter if needed.
/*
INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
SELECT
  imbalanced.journal_entry_id,
  cash_account.id,
  0,
  imbalanced.imbalance,
  'Repair: missing credit line (expense balance fix)'
FROM (
  SELECT
    je.id AS journal_entry_id,
    je.company_id,
    (SUM(jel.debit) - SUM(jel.credit)) AS imbalance
  FROM journal_entries je
  JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
  WHERE (je.reference_type = 'expense' OR je.entry_no ~ '^EXP-[0-9]+$')
    AND je.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  GROUP BY je.id, je.company_id
  HAVING (SUM(jel.debit) - SUM(jel.credit)) > 0.01
) imbalanced
CROSS JOIN LATERAL (
  SELECT id FROM accounts
  WHERE company_id = imbalanced.company_id
    AND (code = '1000' OR name ILIKE '%cash%')
    AND is_active = true
  LIMIT 1
) cash_account;
*/

-- 3) Verification: re-run balance check (should return 0 rows after repair)
-- SELECT je.id, je.entry_no, SUM(jel.debit) AS dr, SUM(jel.credit) AS cr, (SUM(jel.debit) - SUM(jel.credit)) AS imbalance
-- FROM journal_entries je
-- JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
-- WHERE je.reference_type = 'expense' OR je.entry_no ~ '^EXP-[0-9]+$'
-- GROUP BY je.id, je.entry_no
-- HAVING ABS(SUM(jel.debit) - SUM(jel.credit)) > 0.01;
