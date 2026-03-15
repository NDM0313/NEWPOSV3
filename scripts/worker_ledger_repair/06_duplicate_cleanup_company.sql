-- ============================================================================
-- Worker ledger PAYMENT duplicate cleanup (company-scoped)
-- Company: eb71d817-b87e-4195-964b-7b5321b480f5
-- Deletes only DUPLICATE payment rows (reference_type = 'accounting_payment').
-- Keeps ONE row per (worker_id, reference_id): the earliest by created_at.
-- Does NOT touch job/earning rows (studio_production_stage, salary, etc.).
-- Run 04 and 05 first to verify. Safe to run once; re-run has no effect.
-- ============================================================================

-- Delete duplicate payment rows only (keep earliest per worker_id + reference_id).
DELETE FROM worker_ledger_entries
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY worker_id, reference_id ORDER BY created_at ASC) AS rn
    FROM worker_ledger_entries
    WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
      AND reference_type = 'accounting_payment'
  ) ranked
  WHERE ranked.rn > 1
);
