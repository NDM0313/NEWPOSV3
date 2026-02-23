-- ============================================================================
-- EXTEND create_business_transaction: currency, fiscal_year_start, branch name/code
-- ============================================================================
-- Adds optional params for Create Business Wizard. Backward compatible.
-- ============================================================================

-- Drop old 5-param version so we can replace with extended 9-param version
DROP FUNCTION IF EXISTS create_business_transaction(TEXT, TEXT, TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION create_business_transaction(
  p_business_name TEXT,
  p_owner_name TEXT,
  p_email TEXT,
  p_password TEXT,
  p_user_id UUID DEFAULT NULL,
  p_currency TEXT DEFAULT 'PKR',
  p_fiscal_year_start DATE DEFAULT NULL,
  p_branch_name TEXT DEFAULT 'Main Branch',
  p_branch_code TEXT DEFAULT 'HQ'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_company_id UUID;
  v_branch_id UUID;
  v_result JSON;
  v_fiscal_start DATE;
BEGIN
  -- Use provided user_id or generate
  IF p_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
  ELSE
    v_user_id := p_user_id;
  END IF;

  -- Parse fiscal year start (accept YYYY-MM-DD or NULL)
  v_fiscal_start := COALESCE(p_fiscal_year_start::DATE, '2024-01-01'::DATE);

  -- Step 1: Create company (with currency, financial_year_start if columns exist)
  INSERT INTO companies (
    id,
    name,
    email,
    currency,
    is_active,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    p_business_name,
    p_email,
    COALESCE(NULLIF(TRIM(p_currency), ''), 'PKR'),
    true,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_company_id;

  -- Add financial_year_start if column exists (03_frontend_driven_schema)
  BEGIN
    UPDATE companies SET financial_year_start = v_fiscal_start WHERE id = v_company_id;
  EXCEPTION
    WHEN undefined_column THEN NULL;
  END;

  -- Step 2: Create branch with custom name/code
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
    COALESCE(NULLIF(TRIM(p_branch_name), ''), 'Main Branch'),
    COALESCE(NULLIF(TRIM(p_branch_code), ''), 'HQ'),
    true,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_branch_id;

  -- Step 3: Create user in public.users
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

  -- Step 4: Link user to branch
  BEGIN
    INSERT INTO user_branches (user_id, branch_id, is_default, created_at)
    VALUES (v_user_id, v_branch_id, true, NOW());
  EXCEPTION
    WHEN undefined_table THEN NULL;
  END;

  -- Step 5: Create default Piece unit
  INSERT INTO units (
    company_id, name, short_code, symbol, allow_decimal, is_default, is_active, sort_order, created_at, updated_at
  )
  VALUES (
    v_company_id, 'Piece', 'pcs', 'pcs', false, true, true, 0, NOW(), NOW()
  )
  ON CONFLICT (company_id, name) DO NOTHING;

  -- Step 6: Core payment accounts
  IF NOT EXISTS (SELECT 1 FROM accounts WHERE company_id = v_company_id AND code = '1000') THEN
    INSERT INTO accounts (company_id, code, name, type, is_active)
    VALUES (v_company_id, '1000', 'Cash', 'cash', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM accounts WHERE company_id = v_company_id AND code = '1010') THEN
    INSERT INTO accounts (company_id, code, name, type, is_active)
    VALUES (v_company_id, '1010', 'Bank', 'bank', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM accounts WHERE company_id = v_company_id AND code = '1020') THEN
    INSERT INTO accounts (company_id, code, name, type, is_active)
    VALUES (v_company_id, '1020', 'Mobile Wallet', 'mobile_wallet', true);
  END IF;
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
  END IF;

  v_result := json_build_object(
    'success', true,
    'userId', v_user_id,
    'companyId', v_company_id,
    'branchId', v_branch_id
  );
  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION create_business_transaction(TEXT, TEXT, TEXT, TEXT, UUID, TEXT, DATE, TEXT, TEXT) TO service_role;
COMMENT ON FUNCTION create_business_transaction(TEXT, TEXT, TEXT, TEXT, UUID, TEXT, DATE, TEXT, TEXT) IS 'Creates business (company, branch, user) with optional currency, fiscal_year_start, branch name/code.';
