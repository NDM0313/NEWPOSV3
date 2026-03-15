-- ============================================================================
-- Worker ledger PAYMENT verification after dedupe (READ-ONLY)
-- Company: eb71d817-b87e-4195-964b-7b5321b480f5
-- Run after 06 to confirm no duplicate (worker_id, reference_id) for accounting_payment.
-- ============================================================================

-- Should return 0 rows after cleanup.
SELECT
  worker_id,
  reference_id,
  COUNT(*) AS row_count,
  array_agg(id) AS ids
FROM worker_ledger_entries
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND reference_type = 'accounting_payment'
GROUP BY worker_id, reference_id
HAVING COUNT(*) > 1;
