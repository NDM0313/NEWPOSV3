-- Backfill payments rows for general / transfer / manual journal entries with liquidity legs but no payment row.
-- reference_number = 'GE-BF-' || journal_entry_id for reliable payment_id link-back.
-- Run preview_roznamcha_missing_general_entry_payments.sql first.

WITH payment_accounts AS (
  SELECT id
  FROM accounts
  WHERE code IN ('1000', '1010', '1020')
     OR lower(COALESCE(type, '')) IN ('cash', 'bank', 'mobile_wallet', 'wallet', 'card', 'pos')
     OR lower(COALESCE(name, '')) ~ 'cash|bank|wallet|jazz|easypaisa|ndm|mobicash|finja|upaisa|sadapay|nayapay'
),
candidates AS (
  SELECT DISTINCT ON (je.id)
    je.id AS journal_entry_id,
    je.company_id,
    je.branch_id,
    je.entry_no,
    je.entry_date,
    je.description,
    je.created_by AS uid,
    jel.account_id AS payment_account_id,
    jel.debit,
    jel.credit
  FROM journal_entries je
  JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
  JOIN payment_accounts pa ON pa.id = jel.account_id
  WHERE lower(COALESCE(je.reference_type, '')) IN (
      'general', 'transfer', 'journal', 'manual', 'manual_journal', 'manual_receipt', 'manual_payment'
    )
    AND COALESCE(je.is_void, false) = false
    AND je.payment_id IS NULL
    AND je.entry_date >= CURRENT_DATE - 90
    AND (jel.debit > 0 OR jel.credit > 0)
    AND NOT EXISTS (
      SELECT 1
      FROM payments p
      WHERE p.company_id = je.company_id
        AND p.reference_id::text = je.id::text
        AND lower(COALESCE(p.reference_type, '')) IN ('manual_receipt', 'manual_payment')
        AND p.voided_at IS NULL
    )
  ORDER BY je.id, GREATEST(jel.debit, jel.credit) DESC
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
  notes,
  received_by,
  created_by
)
SELECT
  c.company_id,
  c.branch_id,
  CASE WHEN c.debit > 0 THEN 'received'::payment_type ELSE 'paid'::payment_type END,
  CASE WHEN c.debit > 0 THEN 'manual_receipt' ELSE 'manual_payment' END,
  c.journal_entry_id,
  GREATEST(c.debit, c.credit),
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
  'GE-BF-' || c.journal_entry_id::text,
  COALESCE(c.description, c.entry_no),
  c.uid,
  c.uid
FROM candidates c;

UPDATE journal_entries je
SET payment_id = p.id
FROM payments p
WHERE je.payment_id IS NULL
  AND p.reference_number = 'GE-BF-' || je.id::text
  AND lower(COALESCE(p.reference_type, '')) IN ('manual_receipt', 'manual_payment');
