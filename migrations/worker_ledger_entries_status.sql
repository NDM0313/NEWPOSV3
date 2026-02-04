-- worker_ledger_entries: add status (unpaid/paid) and paid_at for Pay Now / Pay Later flow
-- Run once in Supabase SQL Editor. Re-run is safe (ADD COLUMN IF NOT EXISTS).

ALTER TABLE worker_ledger_entries
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'unpaid';

ALTER TABLE worker_ledger_entries
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

ALTER TABLE worker_ledger_entries
  ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(100);

COMMENT ON COLUMN worker_ledger_entries.status IS 'unpaid = payable, paid = payment recorded';
COMMENT ON COLUMN worker_ledger_entries.paid_at IS 'When payment was recorded (Pay Now or via Accounting)';
COMMENT ON COLUMN worker_ledger_entries.payment_reference IS 'Optional reference no for the payment (e.g. WP-xxx)';

-- Backfill existing rows
UPDATE worker_ledger_entries SET status = 'unpaid' WHERE status IS NULL;
