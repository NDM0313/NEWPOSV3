-- Backfill payments rows for expense JEs that never got one (e.g. credit to "NDM EASY").
-- App fix: AccountingContext isPaymentAccount() now treats 102x / ndm / etc. as payment accounts.
-- reference_number = 'PAY-BF-' || journal_entry_id so we can link payment_id back to the JE reliably.
-- Run preview_roznamcha_missing_expense_payments.sql first.

WITH candidates AS (
  SELECT DISTINCT ON (je.id)
    je.id AS journal_entry_id,
    je.company_id,
    je.branch_id,
    je.entry_date,
    je.reference_id AS expense_id,
    jel.credit AS amount,
    jel.account_id AS payment_account_id,
    je.created_by AS uid
  FROM journal_entries je
  JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id AND jel.credit > 0 AND jel.debit = 0
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
  ORDER BY je.id, jel.credit DESC
)
INSERT INTO payments (
  company_id,
  branch_id,
  payment_type,
  reference_type,
  reference_id,
  amount,
  payment_method,
  payment_account_id,
  payment_date,
  reference_number,
  received_by,
  created_by
)
SELECT
  c.company_id,
  c.branch_id,
  'paid',
  'expense',
  c.expense_id,
  c.amount,
  -- payments.payment_method is payment_method_enum: cash | bank | card | other (no mobile_wallet)
  CASE
    WHEN EXISTS (
      SELECT 1 FROM accounts a
      WHERE a.id = c.payment_account_id
        AND (
          lower(COALESCE(a.type, '')) IN ('mobile_wallet', 'wallet')
          OR regexp_replace(split_part(trim(COALESCE(a.code, '')), '-', 1), '\D', '', 'g') ~ '^102'
          OR lower(a.name) ~ 'ndm|jazz|easypaisa|wallet|mobicash|finja|upaisa|sadapay|nayapay'
        )
    ) THEN 'other'::payment_method_enum
    WHEN EXISTS (
      SELECT 1 FROM accounts a
      WHERE a.id = c.payment_account_id
        AND lower(COALESCE(a.type, '')) = 'card'
    ) THEN 'card'::payment_method_enum
    WHEN EXISTS (
      SELECT 1 FROM accounts a
      WHERE a.id = c.payment_account_id
        AND (lower(COALESCE(a.type, '')) = 'bank' OR lower(a.name) ~ 'bank')
    ) THEN 'bank'::payment_method_enum
    WHEN EXISTS (
      SELECT 1 FROM accounts a
      WHERE a.id = c.payment_account_id
        AND (lower(COALESCE(a.type, '')) IN ('cash', 'pos') OR lower(a.name) ~ 'cash')
    ) THEN 'cash'::payment_method_enum
    ELSE 'other'::payment_method_enum
  END,
  c.payment_account_id,
  c.entry_date,
  'PAY-BF-' || c.journal_entry_id::text,
  c.uid,
  c.uid
FROM candidates c;

UPDATE journal_entries je
SET payment_id = p.id
FROM payments p
WHERE je.payment_id IS NULL
  AND p.reference_number = 'PAY-BF-' || je.id::text
  AND lower(COALESCE(p.reference_type, '')) = 'expense';
