-- ============================================================================
-- Accounting Stabilization Phase 1 – APPROVED REPAIR (adds missing lines only)
-- Company: eb71d817-b87e-4195-964b-7b5321b480f5
-- Run only after running diagnostic and repair_preview and verifying rows.
-- No deletes; only INSERTs to balance existing imbalanced expense entries.
-- ============================================================================

-- Add balancing line for each imbalanced expense entry (debit > credit → add credit line; credit > debit → add debit line)
INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
SELECT
  ival.journal_entry_id,
  cash.id,
  CASE WHEN ival.imbalance > 0 THEN 0 ELSE ABS(ival.imbalance) END,
  CASE WHEN ival.imbalance > 0 THEN ival.imbalance ELSE 0 END,
  'Phase-1 repair: balancing line for expense entry'
FROM (
  SELECT
    je.id AS journal_entry_id,
    je.company_id,
    SUM(jel.debit) - SUM(jel.credit) AS imbalance
  FROM journal_entries je
  JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
  WHERE je.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
    AND (je.reference_type = 'expense' OR je.reference_type = 'extra_expense' OR je.description ILIKE '%expense%')
  GROUP BY je.id, je.company_id
  HAVING ABS(SUM(jel.debit) - SUM(jel.credit)) > 0.01
) ival
JOIN LATERAL (
  SELECT id FROM accounts
  WHERE company_id = ival.company_id
    AND (code = '1000' OR LOWER(name) LIKE '%cash%')
  LIMIT 1
) cash ON true;
