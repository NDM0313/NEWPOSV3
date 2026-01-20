-- ============================================================================
-- TASK 2: DEMO ACCOUNT STRUCTURE (DB LEVEL)
-- ============================================================================
-- Purpose: Create demo company, branch, and admin user for demo login
-- ============================================================================

-- Function to create demo company structure
CREATE OR REPLACE FUNCTION create_demo_company()
RETURNS JSON AS $$
DECLARE
    v_company_id UUID;
    v_branch_id UUID;
    v_user_id UUID;
    v_auth_user_id UUID;
    v_demo_email VARCHAR(255) := 'demo@dincollection.com';
    v_demo_password VARCHAR(255) := 'demo123';
BEGIN
    -- Check if demo company already exists
    SELECT id INTO v_company_id FROM companies WHERE is_demo = true LIMIT 1;
    
    IF v_company_id IS NOT NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Demo company already exists',
            'company_id', v_company_id
        );
    END IF;

    -- Step 1: Create auth user (using service role)
    -- Note: This requires service role key, so we'll create it manually or via Supabase Dashboard
    -- For now, we'll create the public.users entry and assume auth user exists
    
    -- Generate a UUID for the user
    v_user_id := uuid_generate_v4();
    
    -- Step 2: Create demo company
    INSERT INTO companies (
        name, email, phone, address, city, country,
        currency, is_active, is_demo
    )
    VALUES (
        'Din Collection - Demo',
        v_demo_email,
        '+92-300-1234567',
        '123 Demo Street, Demo City',
        'Lahore',
        'Pakistan',
        'PKR',
        true,
        true
    )
    RETURNING id INTO v_company_id;

    -- Step 3: Create demo branch
    INSERT INTO branches (
        company_id, name, code, address, city, phone,
        is_active, is_default
    )
    VALUES (
        v_company_id,
        'Main Branch',
        'HQ',
        '123 Demo Street, Demo City',
        'Lahore',
        '+92-300-1234567',
        true,
        true
    )
    RETURNING id INTO v_branch_id;

    -- Step 4: Create user entry (will be linked to auth user when created)
    INSERT INTO users (
        id, company_id, email, full_name, role, is_active
    )
    VALUES (
        v_user_id,
        v_company_id,
        v_demo_email,
        'Demo Admin',
        'admin',
        true
    );

    -- Step 5: Create default accounts for demo company
    PERFORM create_default_accounts(v_company_id);

    -- Return result
    RETURN json_build_object(
        'success', true,
        'company_id', v_company_id,
        'branch_id', v_branch_id,
        'user_id', v_user_id,
        'email', v_demo_email,
        'password', v_demo_password,
        'message', 'Demo company created. Please create auth user manually in Supabase Dashboard.'
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create demo company
DO $$
DECLARE
    result JSON;
BEGIN
    SELECT create_demo_company() INTO result;
    RAISE NOTICE 'Demo company creation result: %', result;
END $$;
