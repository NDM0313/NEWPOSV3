-- ============================================================================
-- STUDIO PRODUCTION – ACCOUNTING INTEGRITY
-- ============================================================================
-- PHASE 1–5: assigned_at, expected_cost, journal link, no schema change for
-- auto-assignment (application enforces: create with status=pending, cost=0, no worker).
-- ============================================================================

-- 1. assigned_at: when manager assigned the worker (PHASE 2)
ALTER TABLE studio_production_stages
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
COMMENT ON COLUMN studio_production_stages.assigned_at IS 'When manager assigned worker to this stage (Assign flow).';

-- 2. expected_cost: set on assign; actual cost locked on complete (PHASE 2)
ALTER TABLE studio_production_stages
  ADD COLUMN IF NOT EXISTS expected_cost NUMERIC(15,2) DEFAULT 0;
COMMENT ON COLUMN studio_production_stages.expected_cost IS 'Expected cost set at assignment; actual cost (cost) locked on complete.';

-- 3. journal_entry_id: link stage to its Dr Expense / Cr Payable entry for reversal (PHASE 3, 4)
ALTER TABLE studio_production_stages
  ADD COLUMN IF NOT EXISTS journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL;
COMMENT ON COLUMN studio_production_stages.journal_entry_id IS 'Journal entry (Dr Production Expense, Cr Worker Payable) created when stage completed; used for reversal on reopen.';

CREATE INDEX IF NOT EXISTS idx_studio_production_stages_journal_entry
  ON studio_production_stages(journal_entry_id) WHERE journal_entry_id IS NOT NULL;
