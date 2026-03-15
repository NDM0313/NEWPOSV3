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
  SELECT (SUBSTRING(p.reference_number FROM 15))::uuid AS journal_entry_id
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
),
mapped AS (
  SELECT
    journal_entry_id,
    company_id,
    branch_id,
    entry_date,
    created_by,
    payment_account_id,
    amount,
    (payment_type)::payment_type AS payment_type,
    CASE
      WHEN LOWER(COALESCE(je_ref_type, '')) IN ('manual_receipt', 'manual_payment') THEN LOWER(je_ref_type)
      WHEN LOWER(COALESCE(je_ref_type, '')) IN ('test_transfer', 'manual', 'test_manual') THEN CASE WHEN payment_type = 'received' THEN 'manual_receipt' ELSE 'manual_payment' END
      WHEN LOWER(COALESCE(je_ref_type, '')) IN ('test_worker_payment', 'worker_payment') THEN 'worker_payment'
      WHEN LOWER(COALESCE(je_ref_type, '')) IN ('expense', 'test_expense', 'extra_expense') THEN 'expense'
      WHEN LOWER(COALESCE(je_ref_type, '')) = 'test_supplier_payment' THEN 'on_account'
      WHEN LOWER(COALESCE(je_ref_type, '')) = 'test_customer_receipt' THEN 'on_account'
      ELSE CASE WHEN payment_type = 'received' THEN 'manual_receipt' ELSE 'manual_payment' END
    END AS pay_ref_type,
    CASE
      WHEN LOWER(COALESCE(je_ref_type, '')) IN ('test_worker_payment', 'worker_payment', 'expense', 'test_expense', 'extra_expense', 'test_supplier_payment', 'test_customer_receipt') THEN je_ref_id
      ELSE NULL
    END AS pay_ref_id
  FROM je_one_line
)
INSERT INTO payments (
  company_id, branch_id, payment_type, reference_type, reference_id,
  amount, payment_method, payment_account_id, payment_date, reference_number,
  received_by, created_by
)
SELECT
  company_id,
  branch_id,
  payment_type,
  pay_ref_type,
  pay_ref_id,
  amount,
  'other',
  payment_account_id,
  entry_date,
  'PAY-BACKFILL-' || journal_entry_id::text,
  created_by,
  created_by
FROM mapped;

UPDATE journal_entries je
SET payment_id = p.id
FROM payments p
WHERE p.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND p.reference_number LIKE 'PAY-BACKFILL-%'
  AND je.id::text = SUBSTRING(p.reference_number FROM 15)
  AND je.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5';
