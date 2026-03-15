-- ============================================================================
-- Legacy Worker Payment Cleanup APPLY (Phase 4)
-- Company: eb71d817-b87e-4195-964b-7b5321b480f5
-- Sets payment_reference = NULL on job/stage rows (studio_production_stage) only.
-- accounting_payment rows keep their payment_reference. No deletes.
-- Run legacy_worker_payment_cleanup_preview.sql first.
-- ============================================================================

UPDATE worker_ledger_entries
SET payment_reference = NULL
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND reference_type = 'studio_production_stage'
  AND (payment_reference IS NOT NULL AND payment_reference <> '');
