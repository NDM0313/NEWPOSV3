-- ============================================
-- 🎯 CHART OF ACCOUNTS - COMPLETE SCHEMA
-- ============================================
-- Migration: 16_chart_of_accounts.sql
-- Description: Complete Chart of Accounts system with all tables, functions, and triggers
-- Created: 2025-01-24

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLE 1: chart_accounts
-- ============================================
CREATE TABLE IF NOT EXISTS chart_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('Assets', 'Liabilities', 'Equity', 'Income', 'Cost of Sales', 'Expenses')),
  sub_category VARCHAR(100) NOT NULL,
  parent_account_id UUID REFERENCES chart_accounts(id) ON DELETE SET NULL,
  modules TEXT[] NOT NULL DEFAULT '{}',
  opening_balance DECIMAL(15, 2) DEFAULT 0,
  current_balance DECIMAL(15, 2) DEFAULT 0,
  nature VARCHAR(10) NOT NULL CHECK (nature IN ('Debit', 'Credit')),
  tax_applicable BOOLEAN DEFAULT FALSE,
  tax_type VARCHAR(50),
  active BOOLEAN DEFAULT TRUE,
  show_in_reports BOOLEAN DEFAULT TRUE,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Indexes for chart_accounts
CREATE INDEX IF NOT EXISTS idx_chart_accounts_category ON chart_accounts(category);
CREATE INDEX IF NOT EXISTS idx_chart_accounts_code ON chart_accounts(code);
CREATE INDEX IF NOT EXISTS idx_chart_accounts_active ON chart_accounts(active);
CREATE INDEX IF NOT EXISTS idx_chart_accounts_parent ON chart_accounts(parent_account_id);

-- ============================================
-- TABLE 2: account_transactions
-- ============================================
CREATE TABLE IF NOT EXISTS account_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_date DATE NOT NULL,
  account_id UUID NOT NULL REFERENCES chart_accounts(id) ON DELETE CASCADE,
  debit DECIMAL(15, 2) DEFAULT 0,
  credit DECIMAL(15, 2) DEFAULT 0,
  running_balance DECIMAL(15, 2) NOT NULL,
  description TEXT,
  module VARCHAR(50) CHECK (module IN ('POS', 'Rental', 'Studio', 'General Accounting', 'All')),
  reference_no VARCHAR(100),
  linked_transaction_id UUID REFERENCES account_transactions(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes for account_transactions
CREATE INDEX IF NOT EXISTS idx_account_transactions_account ON account_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_account_transactions_date ON account_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_account_transactions_module ON account_transactions(module);

-- ============================================
-- TABLE 3: journal_entries
-- ============================================
CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_date DATE NOT NULL,
  entry_type VARCHAR(50) NOT NULL CHECK (entry_type IN ('General', 'Cash Receipt', 'Cash Payment', 'Bank Receipt', 'Bank Payment', 'Transfer')),
  reference_no VARCHAR(100),
  description TEXT,
  total_debit DECIMAL(15, 2) NOT NULL,
  total_credit DECIMAL(15, 2) NOT NULL,
  module VARCHAR(50) CHECK (module IN ('POS', 'Rental', 'Studio', 'General Accounting')),
  status VARCHAR(20) DEFAULT 'Posted' CHECK (status IN ('Draft', 'Posted', 'Void')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraint: Debit must equal Credit
  CONSTRAINT journal_entry_balanced CHECK (total_debit = total_credit)
);

-- Indexes for journal_entries
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_type ON journal_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_journal_entries_status ON journal_entries(status);

-- ============================================
-- TABLE 4: journal_entry_lines
-- ============================================
CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  line_number INT NOT NULL,
  account_id UUID NOT NULL REFERENCES chart_accounts(id),
  description TEXT,
  debit DECIMAL(15, 2) DEFAULT 0,
  credit DECIMAL(15, 2) DEFAULT 0,
  
  -- Constraint: Either debit or credit must be > 0, but not both
  CONSTRAINT journal_line_single_side CHECK (
    (debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)
  )
);

-- Indexes for journal_entry_lines
CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_entry_lines(account_id);

-- ============================================
-- TABLE 5: accounting_audit_logs
-- ============================================
CREATE TABLE IF NOT EXISTS accounting_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id),
  action VARCHAR(50) NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'ACTIVATE', 'DEACTIVATE')),
  account_id UUID REFERENCES chart_accounts(id) ON DELETE SET NULL,
  account_name VARCHAR(255),
  old_value TEXT,
  new_value TEXT,
  details TEXT
);

-- Indexes for accounting_audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON accounting_audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_account ON accounting_audit_logs(account_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON accounting_audit_logs(action);

-- ============================================
-- TABLE 6: automation_rules
-- ============================================
CREATE TABLE IF NOT EXISTS automation_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  module VARCHAR(50) CHECK (module IN ('POS', 'Rental', 'Studio', 'General Accounting')),
  enabled BOOLEAN DEFAULT TRUE,
  description TEXT,
  debit_account_id UUID NOT NULL REFERENCES chart_accounts(id),
  credit_account_id UUID NOT NULL REFERENCES chart_accounts(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for automation_rules
CREATE INDEX IF NOT EXISTS idx_automation_rules_module ON automation_rules(module);
CREATE INDEX IF NOT EXISTS idx_automation_rules_enabled ON automation_rules(enabled);

-- ============================================
-- TABLE 7: accounting_settings
-- ============================================
CREATE TABLE IF NOT EXISTS accounting_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auto_generate_codes BOOLEAN DEFAULT TRUE,
  show_inactive_accounts BOOLEAN DEFAULT FALSE,
  default_tax_rate DECIMAL(5, 2) DEFAULT 18.00,
  tax_type VARCHAR(50) DEFAULT 'GST',
  fiscal_year_start DATE,
  fiscal_year_end DATE,
  account_lock_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE chart_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_settings ENABLE ROW LEVEL SECURITY;

-- Policies for chart_accounts
DROP POLICY IF EXISTS "Allow authenticated read access" ON chart_accounts;
CREATE POLICY "Allow authenticated read access" ON chart_accounts
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated insert access" ON chart_accounts;
CREATE POLICY "Allow authenticated insert access" ON chart_accounts
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated update access" ON chart_accounts;
CREATE POLICY "Allow authenticated update access" ON chart_accounts
  FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated delete access" ON chart_accounts;
CREATE POLICY "Allow authenticated delete access" ON chart_accounts
  FOR DELETE USING (auth.role() = 'authenticated');

-- Policies for account_transactions
DROP POLICY IF EXISTS "Allow authenticated read access" ON account_transactions;
CREATE POLICY "Allow authenticated read access" ON account_transactions
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated insert access" ON account_transactions;
CREATE POLICY "Allow authenticated insert access" ON account_transactions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policies for journal_entries
DROP POLICY IF EXISTS "Allow authenticated full access" ON journal_entries;
CREATE POLICY "Allow authenticated full access" ON journal_entries
  FOR ALL USING (auth.role() = 'authenticated');

-- Policies for journal_entry_lines
DROP POLICY IF EXISTS "Allow authenticated full access" ON journal_entry_lines;
CREATE POLICY "Allow authenticated full access" ON journal_entry_lines
  FOR ALL USING (auth.role() = 'authenticated');

-- Policies for accounting_audit_logs
DROP POLICY IF EXISTS "Allow authenticated read access" ON accounting_audit_logs;
CREATE POLICY "Allow authenticated read access" ON accounting_audit_logs
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated insert access" ON accounting_audit_logs;
CREATE POLICY "Allow authenticated insert access" ON accounting_audit_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policies for automation_rules
DROP POLICY IF EXISTS "Allow authenticated full access" ON automation_rules;
CREATE POLICY "Allow authenticated full access" ON automation_rules
  FOR ALL USING (auth.role() = 'authenticated');

-- Policies for accounting_settings
DROP POLICY IF EXISTS "Allow authenticated full access" ON accounting_settings;
CREATE POLICY "Allow authenticated full access" ON accounting_settings
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- DATABASE FUNCTIONS
-- ============================================

-- Function: Auto-update Account Balance on Transaction
CREATE OR REPLACE FUNCTION update_account_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Update current balance based on account nature
  UPDATE chart_accounts
  SET current_balance = (
    SELECT 
      CASE 
        WHEN nature = 'Debit' 
        THEN opening_balance + COALESCE(SUM(debit - credit), 0)
        ELSE opening_balance + COALESCE(SUM(credit - debit), 0)
      END
    FROM account_transactions
    WHERE account_id = NEW.account_id
  ),
  updated_at = NOW()
  WHERE id = NEW.account_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update balance on transaction insert
DROP TRIGGER IF EXISTS trigger_update_balance ON account_transactions;
CREATE TRIGGER trigger_update_balance
AFTER INSERT ON account_transactions
FOR EACH ROW
EXECUTE FUNCTION update_account_balance();

-- Function: Auto-update Timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers: Update updated_at on chart_accounts
DROP TRIGGER IF EXISTS update_chart_accounts_updated_at ON chart_accounts;
CREATE TRIGGER update_chart_accounts_updated_at
BEFORE UPDATE ON chart_accounts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Triggers: Update updated_at on journal_entries
DROP TRIGGER IF EXISTS update_journal_entries_updated_at ON journal_entries;
CREATE TRIGGER update_journal_entries_updated_at
BEFORE UPDATE ON journal_entries
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Triggers: Update updated_at on automation_rules
DROP TRIGGER IF EXISTS update_automation_rules_updated_at ON automation_rules;
CREATE TRIGGER update_automation_rules_updated_at
BEFORE UPDATE ON automation_rules
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Function: Validate Journal Entry Balance
CREATE OR REPLACE FUNCTION validate_journal_balance()
RETURNS TRIGGER AS $$
DECLARE
  total_debit DECIMAL(15, 2);
  total_credit DECIMAL(15, 2);
BEGIN
  SELECT 
    COALESCE(SUM(debit), 0),
    COALESCE(SUM(credit), 0)
  INTO total_debit, total_credit
  FROM journal_entry_lines
  WHERE journal_entry_id = NEW.journal_entry_id;
  
  IF total_debit != total_credit THEN
    RAISE EXCEPTION 'Journal entry is not balanced: Debit (%) != Credit (%)', total_debit, total_credit;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Validate journal entry balance
DROP TRIGGER IF EXISTS validate_journal_entry_balance ON journal_entry_lines;
CREATE TRIGGER validate_journal_entry_balance
AFTER INSERT OR UPDATE ON journal_entry_lines
FOR EACH ROW
EXECUTE FUNCTION validate_journal_balance();

-- ============================================
-- DEFAULT SETTINGS
-- ============================================

-- Insert default settings (only if not exists)
INSERT INTO accounting_settings (
  auto_generate_codes,
  show_inactive_accounts,
  default_tax_rate,
  tax_type,
  fiscal_year_start,
  fiscal_year_end
)
SELECT 
  TRUE,
  FALSE,
  18.00,
  'GST',
  '2025-01-01',
  '2025-12-31'
WHERE NOT EXISTS (SELECT 1 FROM accounting_settings);

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
