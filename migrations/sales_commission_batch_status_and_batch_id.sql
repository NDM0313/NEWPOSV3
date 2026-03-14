-- Sales: commission batch posting — status, batch reference, and percent.
-- Run after sales_salesman_commission_columns.sql.
-- Safe to run multiple times (IF NOT EXISTS / DO $$).

-- Status: 'pending' until admin posts via commission report; then 'posted'
ALTER TABLE sales ADD COLUMN IF NOT EXISTS commission_status VARCHAR(20) DEFAULT 'pending';
UPDATE sales SET commission_status = 'pending' WHERE commission_status IS NULL;

-- Link to batch when posted (nullable until posted)
ALTER TABLE sales ADD COLUMN IF NOT EXISTS commission_batch_id UUID;

-- Store commission percent at time of sale for audit (optional)
ALTER TABLE sales ADD COLUMN IF NOT EXISTS commission_percent DECIMAL(5,2);

COMMENT ON COLUMN sales.commission_status IS 'pending = not yet posted to ledger; posted = included in a commission batch';
COMMENT ON COLUMN sales.commission_batch_id IS 'Set when commission is posted via Generate to Ledger';
COMMENT ON COLUMN sales.commission_percent IS 'Commission rate at time of sale (for reporting/audit)';

CREATE INDEX IF NOT EXISTS idx_sales_commission_status ON sales(company_id, commission_status) WHERE status = 'final' AND salesman_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_commission_batch_id ON sales(commission_batch_id) WHERE commission_batch_id IS NOT NULL;

-- Commission batches: one row per "Post Commission" action
CREATE TABLE IF NOT EXISTS commission_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  batch_no VARCHAR(50) NOT NULL,
  entry_date DATE NOT NULL,
  salesman_id UUID,
  total_commission NUMERIC(15,2) NOT NULL DEFAULT 0,
  sale_count INTEGER NOT NULL DEFAULT 0,
  journal_entry_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, batch_no)
);

COMMENT ON TABLE commission_batches IS 'One batch per Generate to Ledger action; links to one summarized journal entry';
CREATE INDEX IF NOT EXISTS idx_commission_batches_company ON commission_batches(company_id);
CREATE INDEX IF NOT EXISTS idx_commission_batches_entry_date ON commission_batches(entry_date);
CREATE INDEX IF NOT EXISTS idx_commission_batches_salesman ON commission_batches(salesman_id) WHERE salesman_id IS NOT NULL;

-- Sales Commission Expense (5100) and Salesman Payable (2040) are used by batch posting.
-- Ensure they exist per company via app/seed (e.g. accountHelperService or ensure_erp_accounts RPC).
