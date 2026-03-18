-- PF-14.4: Orphan/Duplicate adjustment cleanup – void support for journal_entries.
-- Safe to run: adds columns with defaults; no data change. Existing rows get is_void = false.
-- Business ledgers/reports exclude rows where is_void = true. Audit tools can show all.

ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS is_void BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS void_reason TEXT,
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by UUID;

COMMENT ON COLUMN journal_entries.is_void IS 'PF-14.4: When true, exclude from business ledgers/statements; keep for audit.';
COMMENT ON COLUMN journal_entries.void_reason IS 'PF-14.4: Reason for void (e.g. duplicate, orphan, cleanup).';
COMMENT ON COLUMN journal_entries.voided_at IS 'PF-14.4: When the entry was voided.';
COMMENT ON COLUMN journal_entries.voided_by IS 'PF-14.4: User who voided (optional).';

CREATE INDEX IF NOT EXISTS idx_journal_entries_is_void
  ON journal_entries (company_id, is_void)
  WHERE is_void = false;
