-- ============================================================================
-- Worker ledger PAYMENT duplicate detection (READ-ONLY)
-- Company: eb71d817-b87e-4195-964b-7b5321b480f5
-- Only payment rows (reference_type = 'accounting_payment'). Does not touch job/earning rows.
-- Run in Supabase SQL Editor. No writes.
-- ============================================================================

-- 1) Duplicate groups: same (company_id, worker_id, reference_type, reference_id) with count > 1
SELECT
  company_id,
  worker_id,
  reference_type,
  reference_id,
  COUNT(*) AS row_count,
  array_agg(id ORDER BY created_at ASC) AS ledger_entry_ids,
  array_agg(amount ORDER BY created_at ASC) AS amounts,
  array_agg(payment_reference ORDER BY created_at ASC) AS payment_refs
FROM worker_ledger_entries
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND reference_type = 'accounting_payment'
GROUP BY company_id, worker_id, reference_type, reference_id
HAVING COUNT(*) > 1
ORDER BY row_count DESC;
