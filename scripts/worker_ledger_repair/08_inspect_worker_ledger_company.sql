-- ============================================================================
-- Worker ledger inspection: group by worker, reference_type, reference_id, amount, date
-- Company: eb71d817-b87e-4195-964b-7b5321b480f5
-- Use to determine: (1) duplicate rows in DB same reference_id (2) many rows different reference_id
-- Run in Supabase SQL Editor. READ-ONLY.
-- ============================================================================

-- 1) All payment rows (accounting_payment) for company, grouped for duplicate analysis
SELECT
  worker_id,
  reference_type,
  reference_id,
  amount,
  created_at::date AS created_date,
  payment_reference,
  COUNT(*) AS row_count,
  array_agg(id ORDER BY created_at) AS ledger_ids
FROM worker_ledger_entries
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND reference_type = 'accounting_payment'
GROUP BY worker_id, reference_type, reference_id, amount, created_at::date, payment_reference
ORDER BY created_date DESC, worker_id, row_count DESC;

-- 2) Duplicate groups only (same worker_id + reference_id, count > 1) = true DB duplicates
SELECT
  worker_id,
  reference_id,
  COUNT(*) AS row_count,
  array_agg(id ORDER BY created_at) AS ledger_entry_ids,
  array_agg(amount ORDER BY created_at) AS amounts,
  array_agg(payment_reference ORDER BY created_at) AS payment_refs
FROM worker_ledger_entries
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND reference_type = 'accounting_payment'
GROUP BY worker_id, reference_id
HAVING COUNT(*) > 1
ORDER BY row_count DESC;

-- 3) Latest 50 payment rows for this company (raw list)
SELECT
  wle.id,
  wle.worker_id,
  w.name AS worker_name,
  wle.amount,
  wle.reference_type,
  wle.reference_id,
  wle.payment_reference,
  wle.created_at,
  wle.paid_at
FROM worker_ledger_entries wle
LEFT JOIN workers w ON w.id = wle.worker_id AND w.company_id = wle.company_id
WHERE wle.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND wle.reference_type = 'accounting_payment'
ORDER BY wle.created_at DESC
LIMIT 50;
