-- ============================================================================
-- Legacy Worker Payment Cleanup PREVIEW (Phase 4)
-- Company: eb71d817-b87e-4195-964b-7b5321b480f5
-- Worker ledger: job/stage rows (studio_production_stage) must NOT have
-- payment_reference set; only accounting_payment rows may carry PAY ref.
-- This preview lists rows that will be fixed (payment_reference set to NULL).
-- ============================================================================

SELECT
  wle.id,
  wle.worker_id,
  wle.amount,
  wle.reference_type,
  wle.reference_id,
  wle.payment_reference,
  wle.status,
  wle.paid_at,
  wle.created_at,
  'SET payment_reference = NULL (job row must not carry PAY ref)' AS recommended_action
FROM worker_ledger_entries wle
WHERE wle.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND wle.reference_type = 'studio_production_stage'
  AND wle.payment_reference IS NOT NULL
  AND wle.payment_reference <> ''
ORDER BY wle.paid_at DESC NULLS LAST, wle.created_at DESC;

-- Count summary
SELECT
  COUNT(*) AS rows_to_fix
FROM worker_ledger_entries wle
WHERE wle.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND wle.reference_type = 'studio_production_stage'
  AND wle.payment_reference IS NOT NULL
  AND wle.payment_reference <> '';
