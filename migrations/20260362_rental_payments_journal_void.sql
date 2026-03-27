-- Rental payment ↔ journal link + live vs audit (voided) for reversal parity with payments table.

ALTER TABLE rental_payments
  ADD COLUMN IF NOT EXISTS journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL;

ALTER TABLE rental_payments
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;

ALTER TABLE rental_payments
  ADD COLUMN IF NOT EXISTS payment_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rental_payments_journal_entry
  ON rental_payments(journal_entry_id)
  WHERE journal_entry_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rental_payments_voided
  ON rental_payments(rental_id)
  WHERE voided_at IS NULL;

COMMENT ON COLUMN rental_payments.journal_entry_id IS 'Primary JE posted for this rental payment (reversal voids the payment row)';
COMMENT ON COLUMN rental_payments.voided_at IS 'When set, excluded from live rental payment history (superseded by journal reversal)';
COMMENT ON COLUMN rental_payments.payment_account_id IS 'Cash/bank account used for this rental payment (optional; matches JE)';
