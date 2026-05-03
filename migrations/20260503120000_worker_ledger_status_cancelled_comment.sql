-- Optional status value: cancelled (voided / no longer payable). App excludes from pending sums.
-- VARCHAR column already allows any value; this documents the convention.

COMMENT ON COLUMN worker_ledger_entries.status IS 'unpaid = payable, paid = payment recorded, cancelled = voided (not payable)';
