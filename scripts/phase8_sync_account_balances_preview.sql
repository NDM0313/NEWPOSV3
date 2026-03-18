-- Phase 8: Preview account balances from journal (voided JEs excluded).
-- Run this to see what balance each account would have from journal_entry_lines.
-- Safe: read-only. Use result to compare with accounts.balance before running sync from app (Integrity Lab → Sync account balances from journal).
-- Optional: add AND a.company_id = 'your-company-uuid' to restrict to one company.

-- Journal-derived balance per account (exclude voided JEs)
SELECT
  a.id AS account_id,
  a.code,
  a.name,
  a.balance AS stored_balance,
  COALESCE(b.journal_balance, 0) AS journal_balance,
  (a.balance - COALESCE(b.journal_balance, 0)) AS difference
FROM accounts a
LEFT JOIN (
  SELECT
    jel.account_id,
    SUM(jel.debit) - SUM(jel.credit) AS journal_balance
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE (je.is_void IS NULL OR je.is_void = false)
  GROUP BY jel.account_id
) b ON b.account_id = a.id
WHERE a.is_active = true
  AND (a.balance - COALESCE(b.journal_balance, 0)) != 0
ORDER BY a.code;
