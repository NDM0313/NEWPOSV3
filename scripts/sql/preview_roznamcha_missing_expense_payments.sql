-- Preview: Paid expense journal entries with NO payments row → missing from Roznamcha.
-- Root cause was isPaymentAccount() false for names like "NDM EASY" (fixed in app for new posts).
-- Run in Supabase SQL Editor; review then run apply_roznamcha_missing_expense_payments.sql

SELECT
  je.id AS journal_entry_id,
  je.entry_no,
  je.company_id,
  je.branch_id,
  je.entry_date,
  je.reference_id::text AS expense_id,
  jel.credit AS amount,
  a.id AS payment_account_id,
  a.name AS payment_account_name,
  a.code AS payment_account_code,
  je.created_by
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id AND jel.credit > 0 AND jel.debit = 0
JOIN accounts a ON a.id = jel.account_id
WHERE lower(COALESCE(je.reference_type, '')) = 'expense'
  AND COALESCE(je.is_void, false) = false
  AND je.payment_id IS NULL
  AND je.reference_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM payments p
    WHERE p.company_id = je.company_id
      AND lower(COALESCE(p.reference_type, '')) = 'expense'
      AND p.reference_id = je.reference_id
      AND COALESCE(p.amount, 0) = COALESCE(jel.credit, 0)
  )
ORDER BY je.entry_date DESC, je.created_at DESC;
