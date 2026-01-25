-- Fix get_or_create_extra_expense_account function to ensure code is always generated

CREATE OR REPLACE FUNCTION get_or_create_extra_expense_account(
  p_company_id UUID,
  p_expense_name VARCHAR
)
RETURNS UUID AS $$
DECLARE
  v_account_id UUID;
  v_account_code VARCHAR;
  v_next_code INTEGER;
  v_exists BOOLEAN;
BEGIN
  -- Validate inputs
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'Company ID is required';
  END IF;
  
  IF p_expense_name IS NULL OR p_expense_name = '' THEN
    RAISE EXCEPTION 'Expense name is required';
  END IF;
  
  -- Try to find existing account with matching name
  SELECT id INTO v_account_id
  FROM accounts
  WHERE company_id = p_company_id
    AND LOWER(name) = LOWER(p_expense_name)
    AND type = 'expense'
  LIMIT 1;
  
  IF v_account_id IS NULL THEN
    -- Get next available code in 5200-5299 range
    SELECT COALESCE(MAX(CAST(code AS INTEGER)), 5199) + 1
    INTO v_next_code
    FROM accounts
    WHERE company_id = p_company_id
      AND code ~ '^[0-9]+$'
      AND CAST(code AS INTEGER) BETWEEN 5200 AND 5299;
    
    -- Ensure code is in valid range
    IF v_next_code IS NULL OR v_next_code < 5200 THEN
      v_next_code := 5200;
    ELSIF v_next_code > 5299 THEN
      -- If all codes in range are used, find next available
      SELECT COALESCE(MAX(CAST(code AS INTEGER)), 5199) + 1
      INTO v_next_code
      FROM accounts
      WHERE company_id = p_company_id
        AND code ~ '^[0-9]+$';
      
      IF v_next_code IS NULL OR v_next_code < 5200 THEN
        v_next_code := 5200;
      END IF;
    END IF;
    
    -- Ensure code is always set
    IF v_next_code IS NULL THEN
      v_next_code := 5200;
    END IF;
    
    v_account_code := v_next_code::TEXT;
    
    -- Check if code already exists (handle race condition)
    SELECT EXISTS(
      SELECT 1 FROM accounts 
      WHERE company_id = p_company_id 
        AND code = v_account_code
    ) INTO v_exists;
    
    -- If code exists, find next available
    WHILE v_exists LOOP
      v_next_code := v_next_code + 1;
      IF v_next_code > 5299 THEN
        v_next_code := 5200;
      END IF;
      v_account_code := v_next_code::TEXT;
      
      SELECT EXISTS(
        SELECT 1 FROM accounts 
        WHERE company_id = p_company_id 
          AND code = v_account_code
      ) INTO v_exists;
    END LOOP;
    
    -- Create new account with guaranteed unique code
    INSERT INTO accounts (
      company_id,
      code,
      name,
      type,
      balance,
      is_active
    ) VALUES (
      p_company_id,
      v_account_code,
      p_expense_name,
      'expense',
      0,
      true
    )
    ON CONFLICT (company_id, code) DO NOTHING
    RETURNING id INTO v_account_id;
    
    -- If insert failed due to conflict, get existing account
    IF v_account_id IS NULL THEN
      SELECT id INTO v_account_id
      FROM accounts
      WHERE company_id = p_company_id
        AND code = v_account_code
      LIMIT 1;
    END IF;
  END IF;
  
  RETURN v_account_id;
END;
$$ LANGUAGE plpgsql;

-- Test the function
SELECT get_or_create_extra_expense_account(
  (SELECT id FROM companies LIMIT 1),
  'Test Expense'
) as test_account_id;
