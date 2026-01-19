-- ============================================
-- FIX MISSING COLUMNS FOR MULTI-TENANT SCHEMA
-- ============================================
-- This script adds company_id to tables that need it
-- Run this after schema.sql if tables already exist

BEGIN;

-- Add company_id to expenses if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'expenses' 
        AND column_name = 'company_id'
    ) THEN
        ALTER TABLE expenses ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_expenses_company ON expenses(company_id);
    END IF;
END $$;

-- Add company_id to payments if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'payments' 
        AND column_name = 'company_id'
    ) THEN
        ALTER TABLE payments ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_payments_company ON payments(company_id);
    END IF;
END $$;

-- Add company_id to accounting_entries if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'accounting_entries' 
        AND column_name = 'company_id'
    ) THEN
        ALTER TABLE accounting_entries ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_accounting_entries_company ON accounting_entries(company_id);
    END IF;
END $$;

-- Add company_id to branches if missing (should reference companies)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'branches' 
        AND column_name = 'company_id'
    ) THEN
        ALTER TABLE branches ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_branches_company ON branches(company_id);
    END IF;
END $$;

-- Add company_id to contacts if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'contacts' 
        AND column_name = 'company_id'
    ) THEN
        ALTER TABLE contacts ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);
    END IF;
END $$;

-- Add company_id to products if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'products' 
        AND column_name = 'company_id'
    ) THEN
        ALTER TABLE products ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_products_company ON products(company_id);
    END IF;
END $$;

-- Add company_id to sales if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'sales' 
        AND column_name = 'company_id'
    ) THEN
        ALTER TABLE sales ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_sales_company ON sales(company_id);
    END IF;
END $$;

-- Add company_id to purchases if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'purchases' 
        AND column_name = 'company_id'
    ) THEN
        ALTER TABLE purchases ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_purchases_company ON purchases(company_id);
    END IF;
END $$;

-- Add company_id to rentals if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'rentals' 
        AND column_name = 'company_id'
    ) THEN
        ALTER TABLE rentals ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_rentals_company ON rentals(company_id);
    END IF;
END $$;

-- Add company_id to accounts if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'accounts' 
        AND column_name = 'company_id'
    ) THEN
        ALTER TABLE accounts ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_accounts_company ON accounts(company_id);
    END IF;
END $$;

-- Add company_id to settings if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'settings' 
        AND column_name = 'company_id'
    ) THEN
        ALTER TABLE settings ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_settings_company ON settings(company_id);
    END IF;
END $$;

-- Add company_id to stock_movements if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'stock_movements' 
        AND column_name = 'company_id'
    ) THEN
        ALTER TABLE stock_movements ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_stock_movements_company ON stock_movements(company_id);
    END IF;
END $$;

-- Add company_id to users if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'company_id'
    ) THEN
        ALTER TABLE users ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
    END IF;
END $$;

-- Add company_id to numbering_rules if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'numbering_rules' 
        AND column_name = 'company_id'
    ) THEN
        ALTER TABLE numbering_rules ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_numbering_rules_company ON numbering_rules(company_id);
    END IF;
END $$;

-- Add company_id to permissions if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'permissions' 
        AND column_name = 'company_id'
    ) THEN
        ALTER TABLE permissions ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_permissions_company ON permissions(company_id);
    END IF;
END $$;

-- Ensure companies table has default company
DO $$
DECLARE
    default_company_id UUID;
BEGIN
    -- Check if default company exists
    SELECT id INTO default_company_id FROM companies WHERE name = 'Din Collection' LIMIT 1;
    
    IF default_company_id IS NULL THEN
        -- Create default company
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
        RETURNING id INTO default_company_id;
    END IF;
    
    -- Update existing records to use default company (if company_id is NULL)
    UPDATE branches SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE contacts SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE products SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE sales SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE purchases SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE rentals SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE expenses SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE accounts SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE payments SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE settings SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE stock_movements SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE accounting_entries SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE users SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE numbering_rules SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE permissions SET company_id = default_company_id WHERE company_id IS NULL;
END $$;

COMMIT;
