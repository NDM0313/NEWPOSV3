-- ============================================
-- FULL DATABASE TRUNCATE - All transaction + master data
-- ============================================
-- KEEPS: companies, branches, users, user_branches, roles, settings, modules_config, units
-- RESETS: numbering_rules, document_sequences (current_number to 0/1)
-- ============================================

BEGIN;

-- Phase A: Line items (child tables)
TRUNCATE TABLE sale_return_items CASCADE;
TRUNCATE TABLE purchase_return_items CASCADE;
TRUNCATE TABLE sale_items CASCADE;
TRUNCATE TABLE purchase_items CASCADE;
TRUNCATE TABLE journal_entry_lines CASCADE;
TRUNCATE TABLE rental_items CASCADE;
DO $$ BEGIN TRUNCATE TABLE expense_items CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE studio_order_items CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Phase B: Transactions & movements
DO $$ BEGIN TRUNCATE TABLE activity_logs CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
TRUNCATE TABLE payments CASCADE;
TRUNCATE TABLE journal_entries CASCADE;
TRUNCATE TABLE stock_movements CASCADE;
TRUNCATE TABLE sale_returns CASCADE;
TRUNCATE TABLE purchase_returns CASCADE;
TRUNCATE TABLE sales CASCADE;
TRUNCATE TABLE purchases CASCADE;
TRUNCATE TABLE expenses CASCADE;
TRUNCATE TABLE rentals CASCADE;
TRUNCATE TABLE studio_orders CASCADE;

-- Credit notes / refunds (if exist)
DO $$ BEGIN TRUNCATE TABLE credit_notes CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE refunds CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Workers / job cards
DO $$ BEGIN TRUNCATE TABLE job_cards CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE workers CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Phase C: Master data
TRUNCATE TABLE contacts CASCADE;
TRUNCATE TABLE product_variations CASCADE;
TRUNCATE TABLE products CASCADE;
TRUNCATE TABLE product_categories CASCADE;
-- Use DELETE for accounts (TRUNCATE CASCADE would cascade to branches/settings)
-- Clear references first
UPDATE branches SET default_cash_account_id = NULL, default_bank_account_id = NULL, default_pos_drawer_account_id = NULL WHERE 1=1;
DO $$ BEGIN UPDATE activity_logs SET payment_account_id = NULL WHERE 1=1; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DELETE FROM accounts;
DO $$ BEGIN TRUNCATE TABLE contact_groups CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE inventory_balance CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Reset numbering (keep structure, reset counters)
DO $$ BEGIN
  UPDATE numbering_rules SET sale_next_number = 1, purchase_next_number = 1, pos_next_number = 1,
    rental_next_number = 1, expense_next_number = 1, product_next_number = 1,
    studio_next_number = 1, payment_next_number = 1 WHERE 1=1;
EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN UPDATE document_sequences SET current_number = 0 WHERE 1=1; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Recreate core payment accounts for each company (Cash, Bank, Mobile Wallet, AR, AP, Operating Expense)
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN SELECT id FROM companies LOOP
    IF NOT EXISTS (SELECT 1 FROM accounts WHERE company_id = c.id AND code = '1000') THEN
      INSERT INTO accounts (company_id, code, name, type, is_active) VALUES (c.id, '1000', 'Cash', 'cash', true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM accounts WHERE company_id = c.id AND code = '1010') THEN
      INSERT INTO accounts (company_id, code, name, type, is_active) VALUES (c.id, '1010', 'Bank', 'bank', true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM accounts WHERE company_id = c.id AND code = '1020') THEN
      INSERT INTO accounts (company_id, code, name, type, is_active) VALUES (c.id, '1020', 'Mobile Wallet', 'mobile_wallet', true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM accounts WHERE company_id = c.id AND code = '1100') THEN
      INSERT INTO accounts (company_id, code, name, type, is_active) VALUES (c.id, '1100', 'Accounts Receivable', 'asset', true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM accounts WHERE company_id = c.id AND code = '2000') THEN
      INSERT INTO accounts (company_id, code, name, type, is_active) VALUES (c.id, '2000', 'Accounts Payable', 'liability', true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM accounts WHERE company_id = c.id AND code = '5000') THEN
      INSERT INTO accounts (company_id, code, name, type, is_active) VALUES (c.id, '5000', 'Operating Expense', 'expense', true);
    END IF;
  END LOOP;
END $$;

COMMIT;
