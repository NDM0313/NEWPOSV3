-- ============================================
-- FULL DATABASE TRUNCATE - All transaction + master data
-- ============================================
-- Total: 53 tables in DB | KEEP: 9 | TRUNCATE: 44
-- KEEPS: companies, branches, users, user_branches, roles, settings, modules_config, units, schema_migrations
-- ============================================

BEGIN;

-- Phase A: Child/line item tables (deepest dependencies first)
TRUNCATE TABLE sale_return_items CASCADE;
TRUNCATE TABLE purchase_return_items CASCADE;
TRUNCATE TABLE sale_items CASCADE;
TRUNCATE TABLE sales_items CASCADE;
TRUNCATE TABLE purchase_items CASCADE;
TRUNCATE TABLE journal_entry_lines CASCADE;
TRUNCATE TABLE rental_items CASCADE;
TRUNCATE TABLE rental_payments CASCADE;
TRUNCATE TABLE product_combo_items CASCADE;
TRUNCATE TABLE studio_order_items CASCADE;
TRUNCATE TABLE studio_production_logs CASCADE;
TRUNCATE TABLE studio_production_stages CASCADE;
TRUNCATE TABLE account_transactions CASCADE;
TRUNCATE TABLE accounting_audit_logs CASCADE;
TRUNCATE TABLE ledger_entries CASCADE;
TRUNCATE TABLE worker_ledger_entries CASCADE;
DO $$ BEGIN TRUNCATE TABLE expense_items CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Phase B: Transaction tables
DO $$ BEGIN UPDATE activity_logs SET payment_account_id = NULL WHERE 1=1; EXCEPTION WHEN undefined_table THEN NULL; END $$;
TRUNCATE TABLE activity_logs CASCADE;
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
TRUNCATE TABLE studio_productions CASCADE;
TRUNCATE TABLE credit_notes CASCADE;
TRUNCATE TABLE refunds CASCADE;
TRUNCATE TABLE job_cards CASCADE;

-- Phase C: Master data
TRUNCATE TABLE contacts CASCADE;
TRUNCATE TABLE product_variations CASCADE;
TRUNCATE TABLE product_combos CASCADE;
TRUNCATE TABLE products CASCADE;
TRUNCATE TABLE product_categories CASCADE;
TRUNCATE TABLE brands CASCADE;
TRUNCATE TABLE contact_groups CASCADE;
TRUNCATE TABLE expense_categories CASCADE;
TRUNCATE TABLE workers CASCADE;
TRUNCATE TABLE ledger_master CASCADE;
TRUNCATE TABLE automation_rules CASCADE;
TRUNCATE TABLE chart_accounts CASCADE;
TRUNCATE TABLE inventory_balance CASCADE;
TRUNCATE TABLE accounting_settings CASCADE;

-- Phase D: accounts (special - branches/settings reference it)
UPDATE branches SET default_cash_account_id = NULL, default_bank_account_id = NULL, default_pos_drawer_account_id = NULL WHERE 1=1;
UPDATE settings SET default_cash_account_id = NULL, default_bank_account_id = NULL WHERE 1=1;
DELETE FROM accounts;

-- Phase E: Reset document sequences
UPDATE document_sequences SET current_number = 0 WHERE 1=1;

-- Phase F: numbering_rules (if exists)
DO $$ BEGIN
  UPDATE numbering_rules SET sale_next_number = 1, purchase_next_number = 1, pos_next_number = 1,
    rental_next_number = 1, expense_next_number = 1, product_next_number = 1,
    studio_next_number = 1, payment_next_number = 1 WHERE 1=1;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Phase G: Recreate core payment accounts for each company
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
