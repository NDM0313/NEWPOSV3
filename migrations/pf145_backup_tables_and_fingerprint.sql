-- PF-14.5B: Duplicate cleanup + accounting integrity.
-- 1) Void support on journal_entries (is_void etc.) – required for index and all PF145 scripts.
-- 2) Backup tables for safe one-time cleanup.
-- 3) Optional action_fingerprint for future duplicate prevention (nullable).
-- Run this entire file once in Supabase SQL Editor. Safe to re-run (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

-- Step 0: Ensure journal_entries has is_void (required by index and verification/classification scripts)
ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS is_void BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS void_reason TEXT,
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by UUID;

COMMENT ON COLUMN journal_entries.is_void IS 'PF-14.4/PF-14.5B: When true, exclude from business ledgers/statements; keep for audit.';
COMMENT ON COLUMN journal_entries.void_reason IS 'Reason for void (e.g. duplicate, orphan, cleanup).';
COMMENT ON COLUMN journal_entries.voided_at IS 'When the entry was voided.';
COMMENT ON COLUMN journal_entries.voided_by IS 'User who voided (optional).';

CREATE INDEX IF NOT EXISTS idx_journal_entries_is_void
  ON journal_entries (company_id, is_void)
  WHERE is_void = false;

-- Backup tables (one-time cleanup backup)
CREATE TABLE IF NOT EXISTS backup_pf145_journal_entries (
  id UUID PRIMARY KEY,
  backup_batch_id UUID NOT NULL DEFAULT gen_random_uuid(),
  backup_reason TEXT NOT NULL DEFAULT 'PF-14.5B cleanup',
  backed_up_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  company_id UUID NOT NULL,
  branch_id UUID,
  entry_no VARCHAR(100),
  entry_date DATE NOT NULL,
  description TEXT,
  reference_type VARCHAR(50),
  reference_id UUID,
  payment_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  is_void BOOLEAN,
  void_reason TEXT,
  voided_at TIMESTAMPTZ,
  voided_by UUID
);

CREATE TABLE IF NOT EXISTS backup_pf145_journal_entry_lines (
  id UUID PRIMARY KEY,
  backup_batch_id UUID NOT NULL,
  journal_entry_id UUID NOT NULL,
  account_id UUID NOT NULL,
  debit DECIMAL(15,2) DEFAULT 0,
  credit DECIMAL(15,2) DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_backup_pf145_je_batch ON backup_pf145_journal_entries(backup_batch_id);
CREATE INDEX IF NOT EXISTS idx_backup_pf145_jel_batch ON backup_pf145_journal_entry_lines(backup_batch_id);

COMMENT ON TABLE backup_pf145_journal_entries IS 'PF-14.5B: Backup of journal_entries before duplicate/cleanup delete or void.';
COMMENT ON TABLE backup_pf145_journal_entry_lines IS 'PF-14.5B: Backup of journal_entry_lines for backed-up JEs.';

-- Optional: action_fingerprint for strict idempotency (set by app when creating adjustment JEs)
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS action_fingerprint TEXT;
COMMENT ON COLUMN journal_entries.action_fingerprint IS 'PF-14.5B: Logical action fingerprint for duplicate prevention; same fingerprint must not create multiple active JEs.';

-- Unique partial index: one active JE per fingerprint per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_entries_fingerprint_active
  ON journal_entries (company_id, action_fingerprint)
  WHERE action_fingerprint IS NOT NULL AND (is_void IS NOT TRUE);
