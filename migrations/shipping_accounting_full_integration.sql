-- ============================================================================
-- SHIPPING ACCOUNTING FULL INTEGRATION
-- ============================================================================
-- Phases covered:
--   Phase 1  — Verify / add missing columns on core tables
--   Phase 2  — Extend Chart of Accounts with shipping / discount / extra expense accounts
--   Phase 4  — Add courier_id column to sale_shipments (courier vendor integration)
--   Phase 5  — shipment_history table
--   Phase 6  — shipment_ledger view
--   Phase 10 — Performance indexes
--
-- Safe to run multiple times (ON CONFLICT / IF NOT EXISTS guards throughout).
-- ============================================================================

-- ============================================================================
-- PHASE 1 — Verify core columns exist
-- ============================================================================

-- sale_shipments: add courier_id (links to contacts.id)
ALTER TABLE sale_shipments
  ADD COLUMN IF NOT EXISTS courier_id UUID REFERENCES contacts(id) ON DELETE SET NULL;

-- sales: add shipment_charges if somehow missing (already added by trigger migration)
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS shipment_charges NUMERIC(15,2) DEFAULT 0;

-- sales: add extra_expenses column (separate from general 'expenses')
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS extra_expenses NUMERIC(15,2) DEFAULT 0;

-- journal_entries: ensure reference_type accommodates new types
-- (No DDL needed — column is VARCHAR(50), just new values will be used)

-- ============================================================================
-- PHASE 2 — Extend Chart of Accounts
-- ============================================================================

CREATE OR REPLACE FUNCTION ensure_shipping_accounts(p_company_id UUID)
RETURNS VOID AS $$
BEGIN
  -- ── ASSETS ──────────────────────────────────────────────────────────────
  -- 1000  Cash
  INSERT INTO accounts (company_id, code, name, type, balance, is_active)
  VALUES (p_company_id, '1000', 'Cash', 'Asset', 0, true)
  ON CONFLICT (company_id, code) DO NOTHING;

  -- 1010  Bank
  INSERT INTO accounts (company_id, code, name, type, balance, is_active)
  VALUES (p_company_id, '1010', 'Bank', 'Asset', 0, true)
  ON CONFLICT (company_id, code) DO NOTHING;

  -- 2000  Accounts Receivable
  INSERT INTO accounts (company_id, code, name, type, balance, is_active)
  VALUES (p_company_id, '2000', 'Accounts Receivable', 'Accounts Receivable', 0, true)
  ON CONFLICT (company_id, code) DO NOTHING;

  -- ── LIABILITIES ─────────────────────────────────────────────────────────
  -- 2010  Worker Payable (already exists)
  INSERT INTO accounts (company_id, code, name, type, balance, is_active)
  VALUES (p_company_id, '2010', 'Worker Payable', 'Liability', 0, true)
  ON CONFLICT (company_id, code) DO NOTHING;

  -- 2020  Accounts Payable (Supplier Payable)
  INSERT INTO accounts (company_id, code, name, type, balance, is_active)
  VALUES (p_company_id, '2020', 'Accounts Payable', 'Liability', 0, true)
  ON CONFLICT (company_id, code) DO NOTHING;

  -- 2030  Courier Payable  ← NEW
  INSERT INTO accounts (company_id, code, name, type, balance, is_active)
  VALUES (p_company_id, '2030', 'Courier Payable', 'Liability', 0, true)
  ON CONFLICT (company_id, code) DO NOTHING;

  -- ── EQUITY ──────────────────────────────────────────────────────────────
  -- 3000  Owner Capital
  INSERT INTO accounts (company_id, code, name, type, balance, is_active)
  VALUES (p_company_id, '3000', 'Owner Capital', 'Equity', 0, true)
  ON CONFLICT (company_id, code) DO NOTHING;

  -- ── REVENUE ─────────────────────────────────────────────────────────────
  -- 4000  Sales Revenue (already exists)
  INSERT INTO accounts (company_id, code, name, type, balance, is_active)
  VALUES (p_company_id, '4000', 'Sales Revenue', 'Revenue', 0, true)
  ON CONFLICT (company_id, code) DO NOTHING;

  -- 4100  Shipping Income  ← NEW
  INSERT INTO accounts (company_id, code, name, type, balance, is_active)
  VALUES (p_company_id, '4100', 'Shipping Income', 'Revenue', 0, true)
  ON CONFLICT (company_id, code) DO NOTHING;

  -- ── EXPENSES ────────────────────────────────────────────────────────────
  -- 5000  Cost of Production (already exists)
  INSERT INTO accounts (company_id, code, name, type, balance, is_active)
  VALUES (p_company_id, '5000', 'Cost of Production', 'Expense', 0, true)
  ON CONFLICT (company_id, code) DO NOTHING;

  -- 5100  Shipping Expense  ← NEW
  INSERT INTO accounts (company_id, code, name, type, balance, is_active)
  VALUES (p_company_id, '5100', 'Shipping Expense', 'Expense', 0, true)
  ON CONFLICT (company_id, code) DO NOTHING;

  -- 5200  Discount Allowed  ← NEW
  INSERT INTO accounts (company_id, code, name, type, balance, is_active)
  VALUES (p_company_id, '5200', 'Discount Allowed', 'Expense', 0, true)
  ON CONFLICT (company_id, code) DO NOTHING;

  -- 5300  Extra Expense  ← NEW
  INSERT INTO accounts (company_id, code, name, type, balance, is_active)
  VALUES (p_company_id, '5300', 'Extra Expense', 'Expense', 0, true)
  ON CONFLICT (company_id, code) DO NOTHING;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'ensure_shipping_accounts failed for company %: %', p_company_id, SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Run for every existing company
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT company_id FROM accounts WHERE company_id IS NOT NULL
  LOOP
    PERFORM ensure_shipping_accounts(r.company_id);
  END LOOP;
END $$;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id AS company_id FROM companies
  LOOP
    PERFORM ensure_shipping_accounts(r.company_id);
  END LOOP;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'companies table not found – skipping';
END $$;

-- ============================================================================
-- PHASE 4 — Add courier_id index
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_sale_shipments_courier_id
  ON sale_shipments (courier_id)
  WHERE courier_id IS NOT NULL;

-- ============================================================================
-- PHASE 5 — Shipment History Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS shipment_history (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id      UUID NOT NULL REFERENCES sale_shipments(id) ON DELETE CASCADE,
  company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  status           VARCHAR(50)     NOT NULL,
  tracking_number  VARCHAR(255),
  courier_name     VARCHAR(255),
  charged_to_customer NUMERIC(15,2) DEFAULT 0,
  actual_cost      NUMERIC(15,2)   DEFAULT 0,
  notes            TEXT,
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ     DEFAULT NOW()
);

-- RLS on shipment_history — company-scoped
ALTER TABLE shipment_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shipment_history_company_access ON shipment_history;
CREATE POLICY shipment_history_company_access ON shipment_history
  FOR ALL
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

CREATE INDEX IF NOT EXISTS idx_shipment_history_shipment_id
  ON shipment_history (shipment_id);

CREATE INDEX IF NOT EXISTS idx_shipment_history_company_id
  ON shipment_history (company_id);

CREATE INDEX IF NOT EXISTS idx_shipment_history_created_at
  ON shipment_history (created_at DESC);

-- ============================================================================
-- PHASE 6 — Shipment Ledger View
-- ============================================================================

DROP VIEW IF EXISTS shipment_ledger;

CREATE VIEW shipment_ledger AS
SELECT
  sh.id                                              AS shipment_id,
  sh.company_id,
  sh.courier_id,
  COALESCE(c.name, sh.courier_name, 'Unknown')       AS courier_name,
  je.entry_date                                      AS date,
  -- When AR is debited it means customer was charged (income side)
  SUM(CASE
    WHEN jel.account_id = a_income.id THEN jel.credit
    ELSE 0
  END)                                               AS shipping_income,
  -- When Shipping Expense is debited it means cost incurred
  SUM(CASE
    WHEN jel.account_id = a_expense.id THEN jel.debit
    ELSE 0
  END)                                               AS shipping_expense,
  -- Net courier payable (credit to Courier Payable)
  SUM(CASE
    WHEN jel.account_id = a_payable.id THEN jel.credit
    ELSE 0
  END)                                               AS courier_payable,
  je.id                                              AS journal_entry_id,
  je.entry_no
FROM
  sale_shipments sh
  JOIN journal_entries je
    ON je.reference_type = 'shipment'
    AND je.reference_id  = sh.id
  JOIN journal_entry_lines jel
    ON jel.journal_entry_id = je.id
  -- Resolve account ids via subselect (avoids lateral join complexity)
  LEFT JOIN LATERAL (
    SELECT id FROM accounts
    WHERE company_id = sh.company_id AND code = '4100' LIMIT 1
  ) a_income ON true
  LEFT JOIN LATERAL (
    SELECT id FROM accounts
    WHERE company_id = sh.company_id AND code = '5100' LIMIT 1
  ) a_expense ON true
  LEFT JOIN LATERAL (
    SELECT id FROM accounts
    WHERE company_id = sh.company_id AND code = '2030' LIMIT 1
  ) a_payable ON true
  LEFT JOIN contacts c ON c.id = sh.courier_id
GROUP BY
  sh.id,
  sh.company_id,
  sh.courier_id,
  c.name,
  sh.courier_name,
  je.entry_date,
  je.id,
  je.entry_no;

-- Grant SELECT to authenticated role so PostgREST can expose it
GRANT SELECT ON shipment_ledger TO authenticated;

-- ============================================================================
-- PHASE 10 — Performance Indexes
-- ============================================================================

-- journal_entries
CREATE INDEX IF NOT EXISTS idx_journal_entries_company_date
  ON journal_entries (company_id, entry_date DESC);

CREATE INDEX IF NOT EXISTS idx_journal_entries_reference
  ON journal_entries (reference_type, reference_id);

CREATE INDEX IF NOT EXISTS idx_journal_entries_branch
  ON journal_entries (branch_id)
  WHERE branch_id IS NOT NULL;

-- journal_entry_lines
CREATE INDEX IF NOT EXISTS idx_jel_journal_entry_id
  ON journal_entry_lines (journal_entry_id);

CREATE INDEX IF NOT EXISTS idx_jel_account_id
  ON journal_entry_lines (account_id);

CREATE INDEX IF NOT EXISTS idx_jel_account_journal
  ON journal_entry_lines (account_id, journal_entry_id);

-- sale_shipments
CREATE INDEX IF NOT EXISTS idx_sale_shipments_sale_id
  ON sale_shipments (sale_id);

CREATE INDEX IF NOT EXISTS idx_sale_shipments_company_id
  ON sale_shipments (company_id);

CREATE INDEX IF NOT EXISTS idx_sale_shipments_status
  ON sale_shipments (shipment_status);

CREATE INDEX IF NOT EXISTS idx_sale_shipments_created_at
  ON sale_shipments (created_at DESC);

-- sales
CREATE INDEX IF NOT EXISTS idx_sales_company_date
  ON sales (company_id, invoice_date DESC);

CREATE INDEX IF NOT EXISTS idx_sales_customer_id
  ON sales (customer_id)
  WHERE customer_id IS NOT NULL;

-- accounts
CREATE INDEX IF NOT EXISTS idx_accounts_company_code
  ON accounts (company_id, code);

-- ============================================================================
-- Verification queries (uncomment to check)
-- ============================================================================
-- SELECT company_id, code, name FROM accounts
-- WHERE code IN ('1000','1010','2000','2020','2030','3000','4000','4100','5000','5100','5200','5300')
-- ORDER BY company_id, code;
--
-- SELECT * FROM shipment_history LIMIT 5;
-- SELECT * FROM shipment_ledger LIMIT 5;
