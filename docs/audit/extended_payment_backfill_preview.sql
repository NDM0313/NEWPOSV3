WITH payment_accounts AS (
  SELECT id FROM accounts
  WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
    AND (code IN ('1000', '1010', '1020')
         OR LOWER(COALESCE(name, '')) LIKE '%cash%'
         OR LOWER(COALESCE(name, '')) LIKE '%bank%'
         OR LOWER(COALESCE(name, '')) LIKE '%wallet%')
),
jes_gap AS (
  SELECT DISTINCT je.id
  FROM journal_entries je
  JOIN journal_entry_lines l ON l.journal_entry_id = je.id
  JOIN payment_accounts pa ON pa.id = l.account_id
  WHERE je.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
    AND je.payment_id IS NULL
),
already_backfilled AS (
  SELECT SUBSTRING(p.reference_number FROM 15)::uuid AS journal_entry_id
  FROM payments p
  WHERE p.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
    AND p.reference_number LIKE 'PAY-BACKFILL-%'
),
candidates AS (
  SELECT j.id FROM jes_gap j
  LEFT JOIN already_backfilled a ON a.journal_entry_id = j.id
  WHERE a.journal_entry_id IS NULL
),
je_one_line AS (
  SELECT DISTINCT ON (c.id)
    c.id AS journal_entry_id,
    je.company_id,
    je.branch_id,
    je.entry_date,
    je.reference_type AS je_ref_type,
    je.reference_id AS je_ref_id,
    je.created_by,
    jel.account_id AS payment_account_id,
    CASE WHEN jel.debit > 0 THEN jel.debit ELSE jel.credit END AS amount,
    CASE WHEN jel.debit > 0 THEN 'received' ELSE 'paid' END AS payment_type
  FROM candidates c
  JOIN journal_entries je ON je.id = c.id
  JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
  JOIN payment_accounts pa ON pa.id = jel.account_id
  WHERE jel.debit > 0 OR jel.credit > 0
  ORDER BY c.id, jel.id
)
SELECT
  x.journal_entry_id,
  x.entry_no,
  x.entry_date,
  x.je_ref_type,
  x.je_ref_id,
  x.payment_account_id,
  x.amount,
  x.payment_type,
  CASE
    WHEN LOWER(COALESCE(x.je_ref_type, '')) IN ('manual_receipt', 'manual_payment') THEN LOWER(x.je_ref_type)
    WHEN LOWER(COALESCE(x.je_ref_type, '')) IN ('test_transfer', 'manual', 'test_manual') THEN CASE WHEN x.payment_type = 'received' THEN 'manual_receipt' ELSE 'manual_payment' END
    WHEN LOWER(COALESCE(x.je_ref_type, '')) IN ('test_worker_payment', 'worker_payment') THEN 'worker_payment'
    WHEN LOWER(COALESCE(x.je_ref_type, '')) IN ('expense', 'test_expense', 'extra_expense') THEN 'expense'
    WHEN LOWER(COALESCE(x.je_ref_type, '')) = 'test_supplier_payment' THEN 'on_account'
    WHEN LOWER(COALESCE(x.je_ref_type, '')) = 'test_customer_receipt' THEN 'on_account'
    ELSE CASE WHEN x.payment_type = 'received' THEN 'manual_receipt' ELSE 'manual_payment' END
  END AS pay_ref_type
FROM (
  SELECT j.journal_entry_id, j.company_id, j.branch_id, j.entry_date, j.je_ref_type, j.je_ref_id, j.created_by, j.payment_account_id, j.amount, j.payment_type, je.entry_no
  FROM je_one_line j
  JOIN journal_entries je ON je.id = j.journal_entry_id
) x;
