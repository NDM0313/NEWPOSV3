-- worker_ledger_entries: central reference for worker job (JOB-0001)
-- When a stage is received/completed, we assign document_no from Settings → Numbering (job).
ALTER TABLE worker_ledger_entries
  ADD COLUMN IF NOT EXISTS document_no VARCHAR(32) NULL;
COMMENT ON COLUMN worker_ledger_entries.document_no IS 'Central reference e.g. JOB-0001 from Numbering Rules. Used for studio_production_stage payables.';
