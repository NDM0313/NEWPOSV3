-- ============================================
-- FINAL FIX - Add company_id without trigger conflicts
-- ============================================

BEGIN;

-- Create helper function for RLS (if not exists)
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID AS $$
DECLARE
    v_company_id UUID;
BEGIN
    -- Try to get company_id from current user
    SELECT company_id INTO v_company_id
    FROM users
    WHERE id = auth.uid()
    LIMIT 1;
    
    -- If not found, return default company
    IF v_company_id IS NULL THEN
        SELECT id INTO v_company_id
        FROM companies
        WHERE name = 'Din Collection'
        LIMIT 1;
    END IF;
    
    RETURN v_company_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get default company ID
DO $$
DECLARE
    default_company_id UUID;
BEGIN
    -- Ensure default company exists
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
    ON CONFLICT (id) DO NOTHING
    RETURNING id INTO default_company_id;
    
    IF default_company_id IS NULL THEN
        SELECT id INTO default_company_id FROM companies WHERE name = 'Din Collection' LIMIT 1;
    END IF;

    -- Disable triggers temporarily to avoid conflicts
    ALTER TABLE sales DISABLE TRIGGER ALL;
    ALTER TABLE purchases DISABLE TRIGGER ALL;
    ALTER TABLE rentals DISABLE TRIGGER ALL;

    -- Add company_id to expenses
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name = 'company_id') THEN
        ALTER TABLE expenses ADD COLUMN company_id UUID;
        UPDATE expenses SET company_id = default_company_id WHERE company_id IS NULL;
        ALTER TABLE expenses ALTER COLUMN company_id SET NOT NULL;
        ALTER TABLE expenses ADD CONSTRAINT expenses_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_expenses_company ON expenses(company_id);
    END IF;

    -- Add company_id to payments
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'company_id') THEN
        ALTER TABLE payments ADD COLUMN company_id UUID;
        UPDATE payments SET company_id = default_company_id WHERE company_id IS NULL;
        ALTER TABLE payments ALTER COLUMN company_id SET NOT NULL;
        ALTER TABLE payments ADD CONSTRAINT payments_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_payments_company ON payments(company_id);
    END IF;

    -- Add company_id to accounting_entries
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounting_entries' AND column_name = 'company_id') THEN
        ALTER TABLE accounting_entries ADD COLUMN company_id UUID;
        UPDATE accounting_entries SET company_id = default_company_id WHERE company_id IS NULL;
        ALTER TABLE accounting_entries ALTER COLUMN company_id SET NOT NULL;
        ALTER TABLE accounting_entries ADD CONSTRAINT accounting_entries_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_accounting_entries_company ON accounting_entries(company_id);
    END IF;

    -- Add company_id to branches
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'branches' AND column_name = 'company_id') THEN
        ALTER TABLE branches ADD COLUMN company_id UUID;
        UPDATE branches SET company_id = default_company_id WHERE company_id IS NULL;
        ALTER TABLE branches ALTER COLUMN company_id SET NOT NULL;
        ALTER TABLE branches ADD CONSTRAINT branches_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_branches_company ON branches(company_id);
    END IF;

    -- Add company_id to contacts
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'company_id') THEN
        ALTER TABLE contacts ADD COLUMN company_id UUID;
        UPDATE contacts SET company_id = default_company_id WHERE company_id IS NULL;
        ALTER TABLE contacts ALTER COLUMN company_id SET NOT NULL;
        ALTER TABLE contacts ADD CONSTRAINT contacts_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);
    END IF;

    -- Add company_id to products
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'company_id') THEN
        ALTER TABLE products ADD COLUMN company_id UUID;
        UPDATE products SET company_id = default_company_id WHERE company_id IS NULL;
        ALTER TABLE products ALTER COLUMN company_id SET NOT NULL;
        ALTER TABLE products ADD CONSTRAINT products_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_products_company ON products(company_id);
    END IF;

    -- Add company_id to sales (with triggers disabled)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sales' AND column_name = 'company_id') THEN
        ALTER TABLE sales ADD COLUMN company_id UUID;
        UPDATE sales SET company_id = default_company_id WHERE company_id IS NULL;
        ALTER TABLE sales ALTER COLUMN company_id SET NOT NULL;
        ALTER TABLE sales ADD CONSTRAINT sales_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_sales_company ON sales(company_id);
    END IF;

    -- Add company_id to purchases (with triggers disabled)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name = 'company_id') THEN
        ALTER TABLE purchases ADD COLUMN company_id UUID;
        UPDATE purchases SET company_id = default_company_id WHERE company_id IS NULL;
        ALTER TABLE purchases ALTER COLUMN company_id SET NOT NULL;
        ALTER TABLE purchases ADD CONSTRAINT purchases_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_purchases_company ON purchases(company_id);
    END IF;

    -- Add company_id to rentals (with triggers disabled)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rentals' AND column_name = 'company_id') THEN
        ALTER TABLE rentals ADD COLUMN company_id UUID;
        UPDATE rentals SET company_id = default_company_id WHERE company_id IS NULL;
        ALTER TABLE rentals ALTER COLUMN company_id SET NOT NULL;
        ALTER TABLE rentals ADD CONSTRAINT rentals_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_rentals_company ON rentals(company_id);
    END IF;

    -- Add company_id to accounts
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'company_id') THEN
        ALTER TABLE accounts ADD COLUMN company_id UUID;
        UPDATE accounts SET company_id = default_company_id WHERE company_id IS NULL;
        ALTER TABLE accounts ALTER COLUMN company_id SET NOT NULL;
        ALTER TABLE accounts ADD CONSTRAINT accounts_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_accounts_company ON accounts(company_id);
    END IF;

    -- Add company_id to settings
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'settings' AND column_name = 'company_id') THEN
        ALTER TABLE settings ADD COLUMN company_id UUID;
        UPDATE settings SET company_id = default_company_id WHERE company_id IS NULL;
        ALTER TABLE settings ALTER COLUMN company_id SET NOT NULL;
        ALTER TABLE settings ADD CONSTRAINT settings_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_settings_company ON settings(company_id);
    END IF;

    -- Add company_id to stock_movements
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'stock_movements' AND column_name = 'company_id') THEN
        ALTER TABLE stock_movements ADD COLUMN company_id UUID;
        UPDATE stock_movements SET company_id = default_company_id WHERE company_id IS NULL;
        ALTER TABLE stock_movements ALTER COLUMN company_id SET NOT NULL;
        ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_stock_movements_company ON stock_movements(company_id);
    END IF;

    -- Add company_id to users
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'company_id') THEN
        ALTER TABLE users ADD COLUMN company_id UUID;
        UPDATE users SET company_id = default_company_id WHERE company_id IS NULL;
        ALTER TABLE users ALTER COLUMN company_id SET NOT NULL;
        ALTER TABLE users ADD CONSTRAINT users_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
    END IF;

    -- Add company_id to numbering_rules
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'numbering_rules' AND column_name = 'company_id') THEN
        ALTER TABLE numbering_rules ADD COLUMN company_id UUID;
        UPDATE numbering_rules SET company_id = default_company_id WHERE company_id IS NULL;
        ALTER TABLE numbering_rules ALTER COLUMN company_id SET NOT NULL;
        ALTER TABLE numbering_rules ADD CONSTRAINT numbering_rules_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_numbering_rules_company ON numbering_rules(company_id);
    END IF;

    -- Add company_id to permissions
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'permissions' AND column_name = 'company_id') THEN
        ALTER TABLE permissions ADD COLUMN company_id UUID;
        UPDATE permissions SET company_id = default_company_id WHERE company_id IS NULL;
        ALTER TABLE permissions ALTER COLUMN company_id SET NOT NULL;
        ALTER TABLE permissions ADD CONSTRAINT permissions_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_permissions_company ON permissions(company_id);
    END IF;

    -- Re-enable triggers
    ALTER TABLE sales ENABLE TRIGGER ALL;
    ALTER TABLE purchases ENABLE TRIGGER ALL;
    ALTER TABLE rentals ENABLE TRIGGER ALL;

END $$;

COMMIT;
