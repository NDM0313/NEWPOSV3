-- ============================================================================
-- WORKER LEDGER: entry_type (payable) – use with status from worker_ledger_entries_status.sql
-- ============================================================================
-- On "Receive from Worker": create ledger entry with entry_type=payable, status=unpaid.
-- Payment happens only when user confirms (Pay Now or later in Accounting).
-- ============================================================================

ALTER TABLE worker_ledger_entries
  ADD COLUMN IF NOT EXISTS entry_type VARCHAR(50) DEFAULT 'payable';

COMMENT ON COLUMN worker_ledger_entries.entry_type IS 'payable = amount owed to worker (stage receive).';
