-- ============================================================================
-- Credit Notes & Refunds for proper sale cancellation accounting
-- Standard ERP: CN for reversal, RF for refund, payments unlinked not deleted
-- Applied via Supabase MCP - keeping local copy for version control
-- ============================================================================

-- Credit Notes (invoice cancellation - full reversal)
CREATE TABLE IF NOT EXISTS credit_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  credit_note_no VARCHAR(50) NOT NULL,
  original_sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
  credit_note_date DATE NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'final' CHECK (status IN ('draft', 'final')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_notes_company_branch_no ON credit_notes(company_id, branch_id, credit_note_no);
CREATE INDEX IF NOT EXISTS idx_credit_notes_original_sale ON credit_notes(original_sale_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_company ON credit_notes(company_id);

-- Refunds (when customer had paid, we return money)
CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  refund_no VARCHAR(50) NOT NULL,
  credit_note_id UUID NOT NULL REFERENCES credit_notes(id) ON DELETE RESTRICT,
  customer_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  amount DECIMAL(15,2) NOT NULL,
  refund_date DATE NOT NULL,
  payment_method VARCHAR(50),
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_refunds_company_branch_no ON refunds(company_id, branch_id, refund_no);
CREATE INDEX IF NOT EXISTS idx_refunds_credit_note ON refunds(credit_note_id);

-- Payment unlink: when sale cancelled, mark payments as voided (don't delete)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS voided_reason TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS original_reference_id UUID;

COMMENT ON TABLE credit_notes IS 'Credit notes for sale cancellation - Dr Sales Return, Cr Customer';
COMMENT ON TABLE refunds IS 'Refunds when cancelled sale had received payments';
