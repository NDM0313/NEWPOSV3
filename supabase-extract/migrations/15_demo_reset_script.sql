-- ============================================================================
-- TASK 4: DEMO DATA RESET STRATEGY
-- ============================================================================
-- Purpose: Reset demo data to clean state
-- ============================================================================

-- Function to reset demo data
CREATE OR REPLACE FUNCTION reset_demo_data()
RETURNS JSON AS $$
DECLARE
    v_company_id UUID;
    v_branch_id UUID;
    v_user_id UUID;
BEGIN
    -- Get demo company
    SELECT id INTO v_company_id FROM companies WHERE is_demo = true LIMIT 1;
    
    IF v_company_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Demo company not found'
        );
    END IF;

    -- Get demo branch and user
    SELECT id INTO v_branch_id FROM branches WHERE company_id = v_company_id AND is_default = true LIMIT 1;
    SELECT id INTO v_user_id FROM users WHERE company_id = v_company_id AND role = 'admin' LIMIT 1;

    -- Delete all demo data (in correct order to respect foreign keys)
    
    -- Delete transactions first
    DELETE FROM payments WHERE company_id = v_company_id;
    DELETE FROM expenses WHERE company_id = v_company_id;
    DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE company_id = v_company_id);
    DELETE FROM sales WHERE company_id = v_company_id;
    DELETE FROM purchase_items WHERE purchase_id IN (SELECT id FROM purchases WHERE company_id = v_company_id);
    DELETE FROM purchases WHERE company_id = v_company_id;
    
    -- Delete stock movements
    DELETE FROM stock_movements WHERE company_id = v_company_id;
    
    -- Delete journal entries
    DELETE FROM journal_entry_lines WHERE journal_entry_id IN (SELECT id FROM journal_entries WHERE company_id = v_company_id);
    DELETE FROM journal_entries WHERE company_id = v_company_id;
    
    -- Delete ledger entries
    DELETE FROM ledger_entries WHERE company_id = v_company_id;
    
    -- Delete products
    DELETE FROM product_variations WHERE product_id IN (SELECT id FROM products WHERE company_id = v_company_id);
    DELETE FROM products WHERE company_id = v_company_id;
    
    -- Delete categories (keep if used by other companies)
    DELETE FROM product_categories WHERE company_id = v_company_id;
    
    -- Delete contacts
    DELETE FROM contacts WHERE company_id = v_company_id;
    
    -- Delete accounts (keep default accounts structure)
    -- Note: We'll recreate default accounts, so delete all
    DELETE FROM accounts WHERE company_id = v_company_id;
    
    -- Recreate default accounts
    PERFORM create_default_accounts(v_company_id);
    
    -- Seed demo data again
    IF v_branch_id IS NOT NULL AND v_user_id IS NOT NULL THEN
        PERFORM seed_demo_data(v_company_id, v_branch_id, v_user_id);
    END IF;

    RETURN json_build_object(
        'success', true,
        'message', 'Demo data reset successfully'
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
