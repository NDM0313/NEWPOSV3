-- ============================================================================
-- Worker Ledger payment_reference Cleanup PREVIEW (Phase-2)
-- Company: eb71d817-b87e-4195-964b-7b5321b480f5
-- Rows that are job/stage (studio_production_stage) but have payment_reference set (contamination).
-- Only accounting_payment rows may carry PAY-xxxx; job rows must NOT.
-- ============================================================================

-- Rows to fix: reference_type = studio_production_stage and payment_reference IS NOT NULL
SELECT
  wle.id,
  wle.worker_id,
  wle.amount,
  wle.reference_type,
  wle.reference_id,
  wle.payment_reference,
  wle.status,
  wle.paid_at,
  'SET payment_reference = NULL (job row must not carry PAY ref)' AS recommended_action
FROM worker_ledger_entries wle
WHERE wle.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND wle.reference_type = 'studio_production_stage'
  AND wle.payment_reference IS NOT NULL
  AND wle.payment_reference <> ''
ORDER BY wle.paid_at DESC NULLS LAST;

-- Count by reference_type and whether payment_reference is set
SELECT
  reference_type,
  COUNT(*) FILTER (WHERE payment_reference IS NOT NULL AND payment_reference <> '') AS with_pay_ref,
  COUNT(*) FILTER (WHERE payment_reference IS NULL OR payment_reference = '') AS without_pay_ref,
  COUNT(*) AS total
FROM worker_ledger_entries
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
GROUP BY reference_type
ORDER BY reference_type;
