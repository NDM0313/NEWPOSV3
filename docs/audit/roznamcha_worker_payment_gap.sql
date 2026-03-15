-- ============================================================================
-- Roznamcha / Worker Payment Gap (Phase-2)
-- Company: eb71d817-b87e-4195-964b-7b5321b480f5
-- Worker payments present in journal/ledger but missing in payments (hence not in Roznamcha).
-- ============================================================================

-- Journal entries (worker_payment) that have no matching payments row
SELECT
  je.id AS journal_entry_id,
  je.entry_no,
  je.entry_date,
  je.reference_id AS worker_id,
  je.payment_id,
  je.description,
  'Journal has no payment_id or payment row missing' AS gap_reason
FROM journal_entries je
WHERE je.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND je.reference_type = 'worker_payment'
  AND (je.payment_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM payments p
    WHERE p.id = je.payment_id AND p.company_id = je.company_id
  ))
ORDER BY je.entry_date DESC;

-- Worker ledger payment rows (accounting_payment) with no matching payments row by reference_number
SELECT
  wle.id AS worker_ledger_id,
  wle.worker_id,
  wle.amount,
  wle.payment_reference,
  wle.paid_at,
  'Ledger has PAY ref but no payments row with that reference_number' AS gap_reason
FROM worker_ledger_entries wle
WHERE wle.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND wle.reference_type = 'accounting_payment'
  AND wle.payment_reference IS NOT NULL
  AND wle.payment_reference <> ''
  AND NOT EXISTS (
    SELECT 1 FROM payments p
    WHERE p.company_id = wle.company_id
      AND p.reference_number = wle.payment_reference
  )
ORDER BY wle.paid_at DESC NULLS LAST;
