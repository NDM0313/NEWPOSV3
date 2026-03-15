-- ============================================================================
-- Backfill worker_ledger_entries from journal entries (worker_payment only)
-- ============================================================================
-- Safe to run multiple times (NOT EXISTS prevents duplicates).
-- Use after deploying the fix that sets journal_entries.reference_type =
-- 'worker_payment' and reference_id = worker_id for new worker payments.
--
-- This inserts rows for journal entries that already have:
--   reference_type = 'worker_payment'
--   reference_id = worker UUID (exists in workers table)
--   Debit line to Worker Payable account
-- and do not yet have a matching worker_ledger_entry (by journal id + worker).
-- ============================================================================

INSERT INTO worker_ledger_entries (
  company_id,
  worker_id,
  amount,
  reference_type,
  reference_id,
  status,
  paid_at,
  payment_reference,
  notes
)
SELECT
  je.company_id,
  je.reference_id AS worker_id,
  jel.debit AS amount,
  'accounting_payment' AS reference_type,
  je.id AS reference_id,
  'paid' AS status,
  COALESCE(je.created_at, NOW()) AS paid_at,
  je.entry_no AS payment_reference,
  COALESCE(je.description, 'Payment via Accounting (backfill)') AS notes
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN accounts a ON a.id = jel.account_id
  AND (a.name ILIKE '%Worker Payable%' OR a.code = '2010' OR a.code = '2100')
WHERE jel.debit > 0
  AND je.reference_id IS NOT NULL
  AND je.reference_type = 'worker_payment'
  AND EXISTS (SELECT 1 FROM workers w WHERE w.id = je.reference_id)
  AND NOT EXISTS (
    SELECT 1 FROM worker_ledger_entries wle
    WHERE wle.reference_type = 'accounting_payment'
      AND wle.reference_id = je.id
      AND wle.worker_id = je.reference_id
  );
