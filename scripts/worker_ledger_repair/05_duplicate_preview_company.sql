-- ============================================================================
-- Worker ledger PAYMENT duplicate preview: which row to KEEP, which to REMOVE
-- Company: eb71d817-b87e-4195-964b-7b5321b480f5
-- Run after 04. No writes. Use output to verify before running 06.
-- ============================================================================

-- Rows to KEEP (one per (worker_id, reference_id): keep earliest created_at)
WITH dup_groups AS (
  SELECT
    company_id,
    worker_id,
    reference_type,
    reference_id,
    COUNT(*) AS row_count
  FROM worker_ledger_entries
  WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
    AND reference_type = 'accounting_payment'
  GROUP BY company_id, worker_id, reference_type, reference_id
  HAVING COUNT(*) > 1
),
ranked AS (
  SELECT
    wle.id,
    wle.company_id,
    wle.worker_id,
    wle.reference_id,
    wle.amount,
    wle.payment_reference,
    wle.created_at,
    ROW_NUMBER() OVER (PARTITION BY wle.worker_id, wle.reference_id ORDER BY wle.created_at ASC) AS rn
  FROM worker_ledger_entries wle
  INNER JOIN dup_groups d
    ON d.company_id = wle.company_id AND d.worker_id = wle.worker_id
    AND d.reference_type = wle.reference_type AND d.reference_id = wle.reference_id
  WHERE wle.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
    AND wle.reference_type = 'accounting_payment'
)
SELECT
  id,
  worker_id,
  reference_id,
  amount,
  payment_reference,
  created_at,
  CASE WHEN rn = 1 THEN 'KEEP' ELSE 'REMOVE' END AS action
FROM ranked
ORDER BY reference_id, created_at;
