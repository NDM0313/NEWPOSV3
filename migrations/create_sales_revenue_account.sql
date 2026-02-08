-- ============================================================================
-- CREATE SALES REVENUE ACCOUNT (IF MISSING)
-- ============================================================================
-- Purpose: Ensure "Sales Revenue" or "Sales" account exists for all companies
-- This account is required for sale journal entries
-- ============================================================================

-- Function to create Sales Revenue account for a company if it doesn't exist
CREATE OR REPLACE FUNCTION ensure_sales_revenue_account(p_company_id UUID)
RETURNS UUID AS $$
DECLARE
    v_account_id UUID;
BEGIN
    -- Check if Sales Revenue or Sales account already exists
    SELECT id INTO v_account_id
    FROM accounts
    WHERE company_id = p_company_id
      AND (
        code = '4000' 
        OR LOWER(name) = LOWER('Sales Revenue')
        OR LOWER(name) = LOWER('Sales')
      )
      AND is_active = true
    LIMIT 1;
    
    -- If account exists, return it
    IF v_account_id IS NOT NULL THEN
        RETURN v_account_id;
    END IF;
    
    -- Create Sales Revenue account if it doesn't exist
    INSERT INTO accounts (company_id, code, name, type, balance, is_active)
    VALUES (p_company_id, '4000', 'Sales Revenue', 'revenue', 0, true)
    RETURNING id INTO v_account_id;
    
    RETURN v_account_id;
END;
$$ LANGUAGE plpgsql;

-- Create Sales Revenue account for all existing companies
-- Method 1: For companies that already have accounts
DO $$
DECLARE
    company_record RECORD;
BEGIN
    FOR company_record IN 
        SELECT DISTINCT company_id 
        FROM accounts 
        WHERE company_id IS NOT NULL
    LOOP
        BEGIN
            PERFORM ensure_sales_revenue_account(company_record.company_id);
            RAISE NOTICE 'Sales Revenue account ensured for company: %', company_record.company_id;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Failed to create Sales Revenue account for company %: %', company_record.company_id, SQLERRM;
        END;
    END LOOP;
END $$;

-- Method 2: For companies from users table (if companies table doesn't exist)
DO $$
DECLARE
    company_record RECORD;
BEGIN
    FOR company_record IN 
        SELECT DISTINCT company_id 
        FROM users 
        WHERE company_id IS NOT NULL
          AND company_id NOT IN (
              SELECT DISTINCT company_id 
              FROM accounts 
              WHERE company_id IS NOT NULL
          )
    LOOP
        BEGIN
            PERFORM ensure_sales_revenue_account(company_record.company_id);
            RAISE NOTICE 'Sales Revenue account created for company from users table: %', company_record.company_id;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Failed to create Sales Revenue account for company %: %', company_record.company_id, SQLERRM;
        END;
    END LOOP;
EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Users table not found, skipping user-based creation';
END $$;

-- Also create for companies that might not have any accounts yet
-- (This handles edge cases where a company exists but has no accounts)
DO $$
DECLARE
    company_record RECORD;
BEGIN
    FOR company_record IN 
        SELECT DISTINCT id as company_id
        FROM companies
        WHERE id NOT IN (
            SELECT DISTINCT company_id 
            FROM accounts 
            WHERE company_id IS NOT NULL
        )
    LOOP
        BEGIN
            PERFORM ensure_sales_revenue_account(company_record.company_id);
            RAISE NOTICE 'Sales Revenue account created for new company: %', company_record.company_id;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Failed to create Sales Revenue account for company %: %', company_record.company_id, SQLERRM;
        END;
    END LOOP;
EXCEPTION WHEN undefined_table THEN
    -- If companies table doesn't exist, that's okay - we'll create accounts for existing company_ids
    RAISE NOTICE 'Companies table not found, skipping company-based creation';
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run this query to verify Sales Revenue accounts exist:
-- SELECT company_id, code, name, type, is_active 
-- FROM accounts 
-- WHERE code = '4000' OR LOWER(name) IN ('sales revenue', 'sales')
-- ORDER BY company_id, code;
