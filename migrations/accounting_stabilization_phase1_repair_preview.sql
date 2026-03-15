-- ============================================================================
-- Accounting Stabilization Phase 1 – REPAIR PREVIEW (no writes)
-- Company: eb71d817-b87e-4195-964b-7b5321b480f5
-- Shows what would be inserted to fix imbalanced EXPENSE journal entries.
-- Run diagnostic first; then run this to preview; apply final repair only after approval.
-- ============================================================================

-- Preview: imbalanced expense entries and the missing credit line we would add
-- (Missing side = credit when debit > credit; use company default Cash 1000 for balancing)
WITH imbalanced AS (
  SELECT
    je.id AS journal_entry_id,
    je.company_id,
    je.entry_no,
    SUM(jel.debit) AS total_debit,
    SUM(jel.credit) AS total_credit,
    SUM(jel.debit) - SUM(jel.credit) AS missing_credit
  FROM journal_entries je
  JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
  WHERE je.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
    AND (je.reference_type = 'expense' OR je.reference_type = 'extra_expense' OR je.description ILIKE '%expense%')
  GROUP BY je.id, je.company_id, je.entry_no
  HAVING SUM(jel.debit) > SUM(jel.credit) AND ABS(SUM(jel.debit) - SUM(jel.credit)) > 0.01
),
cash_account AS (
  SELECT id AS account_id FROM accounts
  WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
    AND (code = '1000' OR LOWER(name) LIKE '%cash%')
  LIMIT 1
)
SELECT
  i.journal_entry_id,
  i.entry_no,
  i.total_debit,
  i.total_credit,
  i.missing_credit AS amount_to_credit,
  c.account_id AS balancing_account_id,
  'INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES (' ||
    quote_literal(i.journal_entry_id::TEXT) || '::uuid, ' ||
    quote_literal(c.account_id::TEXT) || '::uuid, 0, ' || i.missing_credit || ', ''Phase-1 repair: balancing credit'')' AS preview_insert_sql
FROM imbalanced i
CROSS JOIN cash_account c
ORDER BY i.entry_no;
