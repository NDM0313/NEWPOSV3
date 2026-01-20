-- ============================================================================
-- TASK 1: CHART OF ACCOUNTS - DEFAULT ACCOUNTS
-- ============================================================================
-- Purpose: Create minimum required accounts for double-entry accounting
-- ============================================================================

-- Function to create default accounts for a company
CREATE OR REPLACE FUNCTION create_default_accounts(p_company_id UUID)
RETURNS JSON AS $$
DECLARE
    v_cash_account_id UUID;
    v_bank_account_id UUID;
    v_ar_account_id UUID;
    v_ap_account_id UUID;
    v_sales_account_id UUID;
    v_purchase_account_id UUID;
    v_inventory_account_id UUID;
    v_expense_account_id UUID;
    v_cogs_account_id UUID;
BEGIN
    -- 1. Cash Account
    INSERT INTO accounts (company_id, code, name, type, balance, is_active)
    VALUES (p_company_id, '1000', 'Cash', 'Asset', 0, true)
    RETURNING id INTO v_cash_account_id;

    -- 2. Bank Account
    INSERT INTO accounts (company_id, code, name, type, balance, is_active)
    VALUES (p_company_id, '1010', 'Bank', 'Asset', 0, true)
    RETURNING id INTO v_bank_account_id;

    -- 3. Accounts Receivable
    INSERT INTO accounts (company_id, code, name, type, balance, is_active)
    VALUES (p_company_id, '1100', 'Accounts Receivable', 'Asset', 0, true)
    RETURNING id INTO v_ar_account_id;

    -- 4. Accounts Payable
    INSERT INTO accounts (company_id, code, name, type, balance, is_active)
    VALUES (p_company_id, '2000', 'Accounts Payable', 'Liability', 0, true)
    RETURNING id INTO v_ap_account_id;

    -- 5. Sales Revenue
    INSERT INTO accounts (company_id, code, name, type, balance, is_active)
    VALUES (p_company_id, '4000', 'Sales Revenue', 'Revenue', 0, true)
    RETURNING id INTO v_sales_account_id;

    -- 6. Purchase Expense
    INSERT INTO accounts (company_id, code, name, type, balance, is_active)
    VALUES (p_company_id, '5000', 'Purchase Expense', 'Expense', 0, true)
    RETURNING id INTO v_purchase_account_id;

    -- 7. Inventory
    INSERT INTO accounts (company_id, code, name, type, balance, is_active)
    VALUES (p_company_id, '1200', 'Inventory', 'Asset', 0, true)
    RETURNING id INTO v_inventory_account_id;

    -- 8. Cost of Goods Sold (COGS)
    INSERT INTO accounts (company_id, code, name, type, balance, is_active)
    VALUES (p_company_id, '5100', 'Cost of Goods Sold', 'Expense', 0, true)
    RETURNING id INTO v_cogs_account_id;

    -- 9. General Expense
    INSERT INTO accounts (company_id, code, name, type, balance, is_active)
    VALUES (p_company_id, '6000', 'General Expense', 'Expense', 0, true)
    RETURNING id INTO v_expense_account_id;

    -- Return result
    RETURN json_build_object(
        'success', true,
        'cash_account_id', v_cash_account_id,
        'bank_account_id', v_bank_account_id,
        'ar_account_id', v_ar_account_id,
        'ap_account_id', v_ap_account_id,
        'sales_account_id', v_sales_account_id,
        'purchase_account_id', v_purchase_account_id,
        'inventory_account_id', v_inventory_account_id,
        'cogs_account_id', v_cogs_account_id,
        'expense_account_id', v_expense_account_id
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Create default accounts for existing companies
-- ============================================================================

DO $$
DECLARE
    company_record RECORD;
    result JSON;
BEGIN
    FOR company_record IN SELECT id FROM companies WHERE is_demo = false LOOP
        -- Check if company already has accounts
        IF NOT EXISTS (SELECT 1 FROM accounts WHERE company_id = company_record.id) THEN
            SELECT create_default_accounts(company_record.id) INTO result;
            RAISE NOTICE 'Created default accounts for company: %', company_record.id;
        END IF;
    END LOOP;
END $$;
