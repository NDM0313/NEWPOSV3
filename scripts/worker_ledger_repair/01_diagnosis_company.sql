-- ============================================================================
-- Worker payment diagnosis (READ-ONLY)
-- Company: eb71d817-b87e-4195-964b-7b5321b480f5
-- Run in Supabase SQL Editor. No writes.
-- ============================================================================

-- 1) Latest worker payment journal entries (Dr Worker Payable) for this company
SELECT
  je.id AS journal_entry_id,
  je.entry_no,
  je.entry_date,
  je.created_at,
  je.reference_type,
  je.reference_id AS worker_id,
  je.description,
  jel.debit AS amount,
  w.name AS worker_name
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN accounts a ON a.id = jel.account_id
  AND (a.name ILIKE '%Worker Payable%' OR a.code IN ('2010', '2100'))
LEFT JOIN workers w ON w.id = je.reference_id AND w.company_id = je.company_id
WHERE je.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND jel.debit > 0
ORDER BY je.entry_date DESC, je.created_at DESC
LIMIT 30;

-- 2) Latest worker_ledger_entries for this company (accounting_payment)
SELECT
  wle.id,
  wle.worker_id,
  w.name AS worker_name,
  wle.amount,
  wle.paid_at,
  wle.payment_reference,
  wle.reference_id AS journal_entry_id
FROM worker_ledger_entries wle
LEFT JOIN workers w ON w.id = wle.worker_id
WHERE wle.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND wle.reference_type = 'accounting_payment'
ORDER BY wle.paid_at DESC
LIMIT 30;

-- 3) Journal rows that SHOULD map to worker ledger but DO NOT (missing in worker_ledger_entries)
SELECT
  je.id AS journal_entry_id,
  je.entry_no,
  je.entry_date,
  je.reference_type,
  je.reference_id AS worker_id,
  je.description,
  jel.debit AS amount,
  w.name AS worker_name,
  CASE
    WHEN je.reference_type = 'worker_payment' AND je.reference_id IS NOT NULL AND w.id IS NOT NULL THEN 'has_worker_id'
    WHEN je.reference_type IN ('manual', 'payment') AND je.reference_id IS NULL THEN 'legacy_no_worker_id'
    WHEN je.reference_id IS NOT NULL AND w.id IS NULL THEN 'reference_id_not_in_workers'
    ELSE 'other'
  END AS gap_reason
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN accounts a ON a.id = jel.account_id
  AND (a.name ILIKE '%Worker Payable%' OR a.code IN ('2010', '2100'))
LEFT JOIN workers w ON w.id = je.reference_id AND w.company_id = je.company_id
WHERE je.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND jel.debit > 0
  AND NOT EXISTS (
    SELECT 1 FROM worker_ledger_entries wle
    WHERE wle.reference_type = 'accounting_payment'
      AND wle.reference_id = je.id
      AND wle.worker_id = je.reference_id
  )
ORDER BY je.entry_date DESC, je.created_at DESC;
