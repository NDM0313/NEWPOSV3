-- Final fix - Add company_id to all tables
-- This script handles trigger conflicts properly

BEGIN;

-- Step 1: Ensure default company exists
INSERT INTO companies (id, name, email, phone, address, city, state, country, currency, is_active)
VALUES (
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Din Collection',
    'contact@dincollection.com',
    '+92 300 1234567',
    'Main Branch, Lahore, Pakistan',
    'Lahore',
    'Punjab',
    'Pakistan',
    'PKR',
    true
)
ON CONFLICT (id) DO NOTHING;

-- Step 2: Drop problematic triggers temporarily
DROP TRIGGER IF EXISTS trigger_auto_post_sale_to_accounting ON sales;
DROP TRIGGER IF EXISTS trigger_update_stock_on_sale ON sales;
DROP TRIGGER IF EXISTS trigger_auto_post_purchase_to_accounting ON purchases;
DROP TRIGGER IF EXISTS trigger_update_stock_on_purchase ON purchases;

-- Step 3: Add company_id to all tables
DO $$
DECLARE
    default_company_id UUID := '00000000-0000-0000-0000-000000000001'::uuid;
BEGIN
    -- Users (must be first for RLS functions)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'company_id') THEN
        ALTER TABLE users ADD COLUMN company_id UUID;
        UPDATE users SET company_id = default_company_id WHERE company_id IS NULL;
        ALTER TABLE users ALTER COLUMN company_id SET NOT NULL;
        ALTER TABLE users ADD CONSTRAINT users_company_fkey FOREIGN KEY (company_id) REFERENCES companies(id);
        CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
    END IF;

    -- Expenses
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'company_id') THEN
        ALTER TABLE expenses ADD COLUMN company_id UUID;
        UPDATE expenses SET company_id = default_company_id WHERE company_id IS NULL;
        ALTER TABLE expenses ALTER COLUMN company_id SET NOT NULL;
        ALTER TABLE expenses ADD CONSTRAINT expenses_company_fkey FOREIGN KEY (company_id) REFERENCES companies(id);
        CREATE INDEX IF NOT EXISTS idx_expenses_company ON expenses(company_id);
    END IF;

    -- Payments
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'company_id') THEN
        ALTER TABLE payments ADD COLUMN company_id UUID;
        UPDATE payments SET company_id = default_company_id WHERE company_id IS NULL;
        ALTER TABLE payments ALTER COLUMN company_id SET NOT NULL;
        ALTER TABLE payments ADD CONSTRAINT payments_company_fkey FOREIGN KEY (company_id) REFERENCES companies(id);
        CREATE INDEX IF NOT EXISTS idx_payments_company ON payments(company_id);
    END IF;

    -- Accounting entries
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounting_entries' AND column_name = 'company_id') THEN
        ALTER TABLE accounting_entries ADD COLUMN company_id UUID;
        UPDATE accounting_entries SET company_id = default_company_id WHERE company_id IS NULL;
        ALTER TABLE accounting_entries ALTER COLUMN company_id SET NOT NULL;
        ALTER TABLE accounting_entries ADD CONSTRAINT accounting_entries_company_fkey FOREIGN KEY (company_id) REFERENCES companies(id);
        CREATE INDEX IF NOT EXISTS idx_accounting_entries_company ON accounting_entries(company_id);
    END IF;

    -- Branches
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'branches' AND column_name = 'company_id') THEN
        ALTER TABLE branches ADD COLUMN company_id UUID;
        UPDATE branches SET company_id = default_company_id WHERE company_id IS NULL;
        ALTER TABLE branches ALTER COLUMN company_id SET NOT NULL;
        ALTER TABLE branches ADD CONSTRAINT branches_company_fkey FOREIGN KEY (company_id) REFERENCES companies(id);
        CREATE INDEX IF NOT EXISTS idx_branches_company ON branches(company_id);
    END IF;

    -- Contacts
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'company_id') THEN
        ALTER TABLE contacts ADD COLUMN company_id UUID;
        UPDATE contacts SET company_id = default_company_id WHERE company_id IS NULL;
        ALTER TABLE contacts ALTER COLUMN company_id SET NOT NULL;
        ALTER TABLE contacts ADD CONSTRAINT contacts_company_fkey FOREIGN KEY (company_id) REFERENCES companies(id);
        CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);
    END IF;

    -- Products
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'company_id') THEN
        ALTER TABLE products ADD COLUMN company_id UUID;
        UPDATE products SET company_id = default_company_id WHERE company_id IS NULL;
        ALTER TABLE products ALTER COLUMN company_id SET NOT NULL;
        ALTER TABLE products ADD CONSTRAINT products_company_fkey FOREIGN KEY (company_id) REFERENCES companies(id);
        CREATE INDEX IF NOT EXISTS idx_products_company ON products(company_id);
    END IF;

    -- Sales (triggers dropped, safe to update)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'company_id') THEN
        ALTER TABLE sales ADD COLUMN company_id UUID;
        UPDATE sales SET company_id = default_company_id WHERE company_id IS NULL;
        ALTER TABLE sales ALTER COLUMN company_id SET NOT NULL;
        ALTER TABLE sales ADD CONSTRAINT sales_company_fkey FOREIGN KEY (company_id) REFERENCES companies(id);
        CREATE INDEX IF NOT EXISTS idx_sales_company ON sales(company_id);
    END IF;

    -- Purchases (triggers dropped, safe to update)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchases' AND column_name = 'company_id') THEN
        ALTER TABLE purchases ADD COLUMN company_id UUID;
        UPDATE purchases SET company_id = default_company_id WHERE company_id IS NULL;
        ALTER TABLE purchases ALTER COLUMN company_id SET NOT NULL;
        ALTER TABLE purchases ADD CONSTRAINT purchases_company_fkey FOREIGN KEY (company_id) REFERENCES companies(id);
        CREATE INDEX IF NOT EXISTS idx_purchases_company ON purchases(company_id);
    END IF;

    -- Rentals
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rentals' AND column_name = 'company_id') THEN
        ALTER TABLE rentals ADD COLUMN company_id UUID;
        UPDATE rentals SET company_id = default_company_id WHERE company_id IS NULL;
        ALTER TABLE rentals ALTER COLUMN company_id SET NOT NULL;
        ALTER TABLE rentals ADD CONSTRAINT rentals_company_fkey FOREIGN KEY (company_id) REFERENCES companies(id);
        CREATE INDEX IF NOT EXISTS idx_rentals_company ON rentals(company_id);
    END IF;

    -- Accounts
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'company_id') THEN
        ALTER TABLE accounts ADD COLUMN company_id UUID;
        UPDATE accounts SET company_id = default_company_id WHERE company_id IS NULL;
        ALTER TABLE accounts ALTER COLUMN company_id SET NOT NULL;
        ALTER TABLE accounts ADD CONSTRAINT accounts_company_fkey FOREIGN KEY (company_id) REFERENCES companies(id);
        CREATE INDEX IF NOT EXISTS idx_accounts_company ON accounts(company_id);
    END IF;

    -- Settings
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'company_id') THEN
        ALTER TABLE settings ADD COLUMN company_id UUID;
        UPDATE settings SET company_id = default_company_id WHERE company_id IS NULL;
        ALTER TABLE settings ALTER COLUMN company_id SET NOT NULL;
        ALTER TABLE settings ADD CONSTRAINT settings_company_fkey FOREIGN KEY (company_id) REFERENCES companies(id);
        CREATE INDEX IF NOT EXISTS idx_settings_company ON settings(company_id);
    END IF;

    -- Stock movements
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_movements' AND column_name = 'company_id') THEN
        ALTER TABLE stock_movements ADD COLUMN company_id UUID;
        UPDATE stock_movements SET company_id = default_company_id WHERE company_id IS NULL;
        ALTER TABLE stock_movements ALTER COLUMN company_id SET NOT NULL;
        ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_company_fkey FOREIGN KEY (company_id) REFERENCES companies(id);
        CREATE INDEX IF NOT EXISTS idx_stock_movements_company ON stock_movements(company_id);
    END IF;

    -- Numbering rules
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'numbering_rules' AND column_name = 'company_id') THEN
        ALTER TABLE numbering_rules ADD COLUMN company_id UUID;
        UPDATE numbering_rules SET company_id = default_company_id WHERE company_id IS NULL;
        ALTER TABLE numbering_rules ALTER COLUMN company_id SET NOT NULL;
        ALTER TABLE numbering_rules ADD CONSTRAINT numbering_rules_company_fkey FOREIGN KEY (company_id) REFERENCES companies(id);
        CREATE INDEX IF NOT EXISTS idx_numbering_rules_company ON numbering_rules(company_id);
    END IF;

    -- Permissions
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'permissions' AND column_name = 'company_id') THEN
        ALTER TABLE permissions ADD COLUMN company_id UUID;
        UPDATE permissions SET company_id = default_company_id WHERE company_id IS NULL;
        ALTER TABLE permissions ALTER COLUMN company_id SET NOT NULL;
        ALTER TABLE permissions ADD CONSTRAINT permissions_company_fkey FOREIGN KEY (company_id) REFERENCES companies(id);
        CREATE INDEX IF NOT EXISTS idx_permissions_company ON permissions(company_id);
    END IF;

END $$;

-- Step 4: Recreate triggers (from functions.sql)
CREATE TRIGGER trigger_auto_post_sale_to_accounting
  AFTER UPDATE ON sales
  FOR EACH ROW
  WHEN (NEW.status = 'final' AND (OLD.status IS NULL OR OLD.status != 'final'))
  EXECUTE FUNCTION auto_post_sale_to_accounting();

CREATE TRIGGER trigger_update_stock_on_sale
  AFTER INSERT OR UPDATE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_on_sale();

CREATE TRIGGER trigger_auto_post_purchase_to_accounting
  AFTER UPDATE ON purchases
  FOR EACH ROW
  WHEN (NEW.status = 'final' AND (OLD.status IS NULL OR OLD.status != 'final'))
  EXECUTE FUNCTION auto_post_purchase_to_accounting();

CREATE TRIGGER trigger_update_stock_on_purchase
  AFTER INSERT OR UPDATE ON purchases
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_on_purchase();

COMMIT;
