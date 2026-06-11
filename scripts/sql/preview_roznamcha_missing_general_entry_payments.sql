-- Preview: General / transfer / manual journal entries with liquidity legs but NO payments row.
-- These are missing from Roznamcha when payment_id is null and no manual_receipt/manual_payment exists.
-- Run before apply_roznamcha_missing_general_entry_payments.sql

WITH payment_accounts AS (
  SELECT id, code, name, type
  FROM accounts
  WHERE code IN ('1000', '1010', '1020')
     OR lower(COALESCE(type, '')) IN ('cash', 'bank', 'mobile_wallet', 'wallet', 'card', 'pos')
     OR lower(COALESCE(name, '')) ~ 'cash|bank|wallet|jazz|easypaisa|ndm|mobicash|finja|upaisa|sadapay|nayapay'
),
manual_jes AS (
  SELECT je.id, je.company_id, je.branch_id, je.entry_no, je.entry_date, je.description,
         je.reference_type, je.payment_id, je.created_by, je.created_at
  FROM journal_entries je
  WHERE lower(COALESCE(je.reference_type, '')) IN (
      'general', 'transfer', 'journal', 'manual', 'manual_journal', 'manual_receipt', 'manual_payment'
    )
    AND COALESCE(je.is_void, false) = false
    AND je.payment_id IS NULL
    AND je.entry_date >= CURRENT_DATE - 90
),
liquidity_legs AS (
  SELECT DISTINCT ON (je.id)
    je.id AS journal_entry_id,
    je.company_id,
    je.branch_id,
    je.entry_no,
    je.entry_date,
    je.description,
    je.reference_type,
    je.created_by,
    jel.account_id AS payment_account_id,
    jel.debit,
    jel.credit,
    a.name AS payment_account_name,
    a.code AS payment_account_code,
    a.type AS payment_account_type
  FROM manual_jes je
  JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
  JOIN payment_accounts pa ON pa.id = jel.account_id
  JOIN accounts a ON a.id = jel.account_id
  WHERE (jel.debit > 0 OR jel.credit > 0)
  ORDER BY je.id, GREATEST(jel.debit, jel.credit) DESC
)
SELECT l.journal_entry_id,
       l.entry_no,
       l.entry_date,
       l.reference_type,
       l.branch_id,
       l.debit,
       l.credit,
       l.payment_account_name,
       l.payment_account_code,
       CASE WHEN l.debit > 0 THEN 'manual_receipt' ELSE 'manual_payment' END AS proposed_payment_ref_type,
       CASE WHEN l.debit > 0 THEN 'received' ELSE 'paid' END AS proposed_payment_type,
       GREATEST(l.debit, l.credit) AS proposed_amount
FROM liquidity_legs l
WHERE NOT EXISTS (
  SELECT 1
  FROM payments p
  WHERE p.company_id = l.company_id
    AND p.reference_id::text = l.journal_entry_id::text
    AND lower(COALESCE(p.reference_type, '')) IN ('manual_receipt', 'manual_payment')
    AND p.voided_at IS NULL
)
ORDER BY l.entry_date DESC, l.entry_no DESC;

-- Targeted check for the two reported entries
SELECT 'TARGET' AS scope, l.*
FROM (
  SELECT je.id AS journal_entry_id, je.entry_no, je.payment_id, je.branch_id
  FROM journal_entries je
  WHERE je.entry_no IN ('JE-0017', 'JV-000202')
) l;
