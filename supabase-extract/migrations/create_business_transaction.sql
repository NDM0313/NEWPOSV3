-- ============================================================================
-- CREATE BUSINESS TRANSACTION FUNCTION
-- ============================================================================
-- This function creates a business (company, branch, user) in a single transaction
-- Returns: JSON with success, userId, companyId, branchId, or error
-- ============================================================================

CREATE OR REPLACE FUNCTION create_business_transaction(
  p_business_name TEXT,
  p_owner_name TEXT,
  p_email TEXT,
  p_password TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_company_id UUID;
  v_branch_id UUID;
  v_auth_user_id UUID;
  v_result JSON;
BEGIN
  -- Start transaction (implicit in function)
  
  -- Step 1: If user_id provided, use it; otherwise generate new UUID
  IF p_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
  ELSE
    v_user_id := p_user_id;
  END IF;
  
  -- Step 2: Create company
  INSERT INTO companies (
    id,
    name,
    email,
    is_active,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    p_business_name,
    p_email,
    true,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_company_id;
  
  -- Step 3: Create default branch
  INSERT INTO branches (
    id,
    company_id,
    name,
    code,
    is_active,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    v_company_id,
    'Main Branch',
    'HQ',
    true,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_branch_id;
  
  -- Step 4: Create user entry in public.users
  INSERT INTO users (
    id,
    company_id,
    email,
    full_name,
    role,
    is_active,
    created_at,
    updated_at
  )
  VALUES (
    v_user_id,
    v_company_id,
    p_email,
    p_owner_name,
    'admin',
    true,
    NOW(),
    NOW()
  );
  
  -- Step 5: Link user to branch (if table exists)
  BEGIN
    INSERT INTO user_branches (
      user_id,
      branch_id,
      is_default,
      created_at
    )
    VALUES (
      v_user_id,
      v_branch_id,
      true,
      NOW()
    );
  EXCEPTION
    WHEN undefined_table THEN
      -- Table doesn't exist, skip (non-critical)
      NULL;
  END;
  
  -- Step 6: Create default Piece unit (MANDATORY)
  -- This is the backbone unit for every business
  INSERT INTO units (
    company_id,
    name,
    short_code,
    symbol,
    allow_decimal,
    is_default,
    is_active,
    sort_order,
    created_at,
    updated_at
  )
  VALUES (
    v_company_id,
    'Piece',
    'pcs',
    'pcs',
    false,  -- Piece does NOT allow decimals
    true,   -- This is the default unit
    true,   -- Always active
    0,      -- First in sort order
    NOW(),
    NOW()
  )
  ON CONFLICT DO NOTHING;  -- Prevent duplicate if somehow exists
  
  -- Step 7: Create CORE PAYMENT ACCOUNTS (NON-NEGOTIABLE)
  -- ============================================================================
  -- 🔒 CORE ACCOUNTING BACKBONE RULE:
  -- These 3 accounts (Cash, Bank, Mobile Wallet) are MANDATORY for EVERY business
  -- They exist regardless of Accounting Module ON/OFF status
  -- They CANNOT be deleted, only renamed (optional)
  -- ============================================================================
  
  -- Core Account 1: Cash (code: 1000)
  IF NOT EXISTS (SELECT 1 FROM accounts WHERE company_id = v_company_id AND code = '1000') THEN
    INSERT INTO accounts (company_id, code, name, type, is_active)
    VALUES (v_company_id, '1000', 'Cash', 'cash', true);
  END IF;
  
  -- Core Account 2: Bank (code: 1010)
  IF NOT EXISTS (SELECT 1 FROM accounts WHERE company_id = v_company_id AND code = '1010') THEN
    INSERT INTO accounts (company_id, code, name, type, is_active)
    VALUES (v_company_id, '1010', 'Bank', 'bank', true);
  END IF;
  
  -- Core Account 3: Mobile Wallet (code: 1020)
  IF NOT EXISTS (SELECT 1 FROM accounts WHERE company_id = v_company_id AND code = '1020') THEN
    INSERT INTO accounts (company_id, code, name, type, is_active)
    VALUES (v_company_id, '1020', 'Mobile Wallet', 'mobile_wallet', true);
  END IF;
  
  -- Additional Account: Accounts Receivable (code: 1100)
  -- Required for customer payment entries (accounting module)
  IF NOT EXISTS (SELECT 1 FROM accounts WHERE company_id = v_company_id AND code = '1100') THEN
    INSERT INTO accounts (company_id, code, name, type, is_active)
    VALUES (v_company_id, '1100', 'Accounts Receivable', 'asset', true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM accounts WHERE company_id = v_company_id AND code = '2000') THEN
    INSERT INTO accounts (company_id, code, name, type, is_active)
    VALUES (v_company_id, '2000', 'Accounts Payable', 'liability', true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM accounts WHERE company_id = v_company_id AND code = '5000') THEN
    INSERT INTO accounts (company_id, code, name, type, is_active)
    VALUES (v_company_id, '5000', 'Operating Expense', 'expense', true);
  END IF;  -- Prevent duplicates
  
  -- Return success result
  v_result := json_build_object(
    'success', true,
    'userId', v_user_id,
    'companyId', v_company_id,
    'branchId', v_branch_id
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Rollback (automatic in function)
    -- Return error result
    v_result := json_build_object(
      'success', false,
      'error', SQLERRM
    );
    
    RETURN v_result;
END;
$$;

-- Grant execute permission to service_role (for business creation)
GRANT EXECUTE ON FUNCTION create_business_transaction TO service_role;

-- Comment
COMMENT ON FUNCTION create_business_transaction IS 'Creates a business (company, branch, user) in a single transaction. Returns JSON with success status and IDs or error message.';
