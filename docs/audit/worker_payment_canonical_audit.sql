-- ============================================================================
-- Worker Payment Canonical Audit (Phase-2)
-- Company: eb71d817-b87e-4195-964b-7b5321b480f5
-- Latest worker payments across payments, journal_entries, worker_ledger_entries.
-- ============================================================================

-- 1) Worker payments in payments table (reference_type = worker_payment)
SELECT
  p.id AS payment_id,
  p.reference_number,
  p.payment_date,
  p.amount,
  p.payment_method,
  p.reference_id AS worker_id,
  p.payment_account_id,
  p.created_at
FROM payments p
WHERE p.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND p.reference_type = 'worker_payment'
ORDER BY p.payment_date DESC, p.created_at DESC
LIMIT 50;

-- 2) Journal entries for worker payments (reference_type = worker_payment)
SELECT
  je.id AS journal_entry_id,
  je.entry_no,
  je.entry_date,
  je.reference_type,
  je.reference_id,
  je.payment_id,
  je.description,
  je.created_at
FROM journal_entries je
WHERE je.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND je.reference_type = 'worker_payment'
ORDER BY je.entry_date DESC, je.created_at DESC
LIMIT 50;

-- 3) Worker ledger payment rows (reference_type = accounting_payment)
SELECT
  wle.id,
  wle.worker_id,
  wle.amount,
  wle.reference_type,
  wle.reference_id,
  wle.payment_reference,
  wle.status,
  wle.paid_at,
  wle.created_at
FROM worker_ledger_entries wle
WHERE wle.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND wle.reference_type = 'accounting_payment'
ORDER BY wle.paid_at DESC NULLS LAST, wle.created_at DESC
LIMIT 50;

-- 4) Join: payment → journal → worker_ledger (canonical triplet)
SELECT
  p.id AS payment_id,
  p.reference_number,
  p.payment_date,
  p.amount,
  je.id AS journal_entry_id,
  je.entry_no,
  wle.id AS worker_ledger_id,
  wle.payment_reference AS ledger_payment_ref
FROM payments p
LEFT JOIN journal_entries je ON je.payment_id = p.id AND je.company_id = p.company_id
LEFT JOIN worker_ledger_entries wle ON wle.company_id = p.company_id
  AND wle.reference_type = 'accounting_payment'
  AND wle.reference_id = je.id
WHERE p.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND p.reference_type = 'worker_payment'
ORDER BY p.payment_date DESC
LIMIT 30;
