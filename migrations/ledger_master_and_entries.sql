-- Ledger master + entries for Supplier & User ledgers.
-- Customer ledger = sales/payments. Worker = worker_ledger_entries.
--
-- IMPORTANT: Run this in Supabase SQL Editor. Until these tables exist and
-- Purchase/Expense flows post entries here, Supplier & User Ledger UI will be empty.
--
-- Posting rules:
--   Supplier: Purchase create → Credit; Payment (recordPayment or paid on create) → Debit.
--   User: Salary/expense (paidToUserId) → Debit; Payment → Credit (when implemented).
--
-- If REFERENCES companies(id) fails (e.g. no companies table), use the alternate
-- block at the end of this file that omits the FK.

DROP TABLE IF EXISTS ledger_entries CASCADE;
DROP TABLE IF EXISTS ledger_master CASCADE;

CREATE TABLE ledger_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  ledger_type VARCHAR(20) NOT NULL CHECK (ledger_type IN ('supplier', 'user')),
  entity_id UUID NOT NULL,
  entity_name TEXT,
  opening_balance DECIMAL(18,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, ledger_type, entity_id)
);

CREATE TABLE ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  ledger_id UUID NOT NULL REFERENCES ledger_master(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  debit DECIMAL(18,2) NOT NULL DEFAULT 0,
  credit DECIMAL(18,2) NOT NULL DEFAULT 0,
  balance_after DECIMAL(18,2),
  source VARCHAR(50) NOT NULL,
  reference_no VARCHAR(100),
  reference_id UUID,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ledger_master_company_type ON ledger_master(company_id, ledger_type);
CREATE INDEX IF NOT EXISTS idx_ledger_master_entity ON ledger_master(company_id, ledger_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_ledger_date ON ledger_entries(ledger_id, entry_date);

COMMENT ON TABLE ledger_master IS 'One ledger per supplier or user for payables/expenses';
COMMENT ON TABLE ledger_entries IS 'Debit/credit entries for supplier and user ledgers';
