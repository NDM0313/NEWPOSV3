-- Phase 4: Legacy worker payment cleanup (payment_reference on job rows)
-- Company: eb71d817-b87e-4195-964b-7b5321b480f5
UPDATE worker_ledger_entries
SET payment_reference = NULL
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND reference_type = 'studio_production_stage'
  AND (payment_reference IS NOT NULL AND payment_reference <> '');
