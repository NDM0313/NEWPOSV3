-- ============================================================================
-- Migration 60: create_business_transaction — set auth_user_id in users insert
-- ============================================================================
-- App looks up public.users by id OR auth_user_id = auth.uid(). The RPC was
-- only setting users.id = p_user_id; auth_user_id was left NULL. On DBs where
-- RLS or app logic expects auth_user_id, the new user was not found after login.
-- Fix: set auth_user_id = p_user_id when inserting into users.
-- ============================================================================

-- Ensure column exists (idempotent; no-op if already from identity migration)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_user_id UUID;

DO $$
BEGIN
  DROP FUNCTION IF EXISTS create_business_transaction(TEXT, TEXT, TEXT, TEXT, UUID, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '60: Skip drop create_business_transaction: %', SQLERRM;
END $$;

DO $$
BEGIN
  EXECUTE $m60$
CREATE OR REPLACE FUNCTION create_business_transaction(
  p_business_name TEXT,
  p_owner_name TEXT,
  p_email TEXT,
  p_password TEXT,
  p_user_id UUID DEFAULT NULL,
  p_currency TEXT DEFAULT 'PKR',
  p_fiscal_year_start DATE DEFAULT NULL,
  p_branch_name TEXT DEFAULT 'Main Branch',
  p_branch_code TEXT DEFAULT 'HQ',
  p_phone TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_country TEXT DEFAULT NULL,
  p_timezone TEXT DEFAULT NULL,
  p_business_type TEXT DEFAULT NULL,
  p_modules JSONB DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $body$
DECLARE
  v_user_id UUID;
  v_company_id UUID;
  v_branch_id UUID;
  v_result JSON;
  v_fiscal_start DATE;
  v_module TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
  ELSE
    v_user_id := p_user_id;
  END IF;

  v_fiscal_start := COALESCE(p_fiscal_year_start::DATE, '2024-01-01'::DATE);

  INSERT INTO companies (
    id, name, email, currency, is_active, created_at, updated_at,
    phone, address, country, timezone, business_type
  )
  VALUES (
    gen_random_uuid(),
    p_business_name,
    p_email,
    COALESCE(NULLIF(TRIM(p_currency), ''), 'PKR'),
    true, NOW(), NOW(),
    NULLIF(TRIM(COALESCE(p_phone, '')), ''),
    NULLIF(TRIM(COALESCE(p_address, '')), ''),
    NULLIF(TRIM(COALESCE(p_country, '')), ''),
    NULLIF(TRIM(COALESCE(p_timezone, '')), ''),
    NULLIF(TRIM(COALESCE(p_business_type, '')), '')
  )
  RETURNING id INTO v_company_id;

  BEGIN
    UPDATE companies SET financial_year_start = v_fiscal_start WHERE id = v_company_id;
  EXCEPTION WHEN undefined_column THEN NULL;
  END;

  INSERT INTO branches (
    id, company_id, name, code, is_active, created_at, updated_at,
    address, phone, country
  )
  VALUES (
    gen_random_uuid(),
    v_company_id,
    COALESCE(NULLIF(TRIM(p_branch_name), ''), 'Main Branch'),
    COALESCE(NULLIF(TRIM(p_branch_code), ''), 'HQ'),
    true, NOW(), NOW(),
    NULLIF(TRIM(COALESCE(p_address, '')), ''),
    NULLIF(TRIM(COALESCE(p_phone, '')), ''),
    NULLIF(TRIM(COALESCE(p_country, '')), '')
  )
  RETURNING id INTO v_branch_id;

  -- Set both id and auth_user_id so login lookup (id OR auth_user_id = auth.uid()) always finds the row
  INSERT INTO users (id, company_id, email, full_name, role, is_active, created_at, updated_at, auth_user_id)
  VALUES (v_user_id, v_company_id, p_email, p_owner_name, 'admin', true, NOW(), NOW(), p_user_id);

  BEGIN
    INSERT INTO user_branches (user_id, branch_id, is_default, created_at)
    VALUES (v_user_id, v_branch_id, true, NOW());
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  INSERT INTO units (company_id, name, short_code, symbol, allow_decimal, is_default, is_active, sort_order, created_at, updated_at)
  VALUES (v_company_id, 'Piece', 'pcs', 'pcs', false, true, true, 0, NOW(), NOW())
  ON CONFLICT (company_id, name) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM accounts WHERE company_id = v_company_id AND code = '1000') THEN
    INSERT INTO accounts (company_id, code, name, type, is_active) VALUES (v_company_id, '1000', 'Cash', 'cash', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM accounts WHERE company_id = v_company_id AND code = '1010') THEN
    INSERT INTO accounts (company_id, code, name, type, is_active) VALUES (v_company_id, '1010', 'Bank', 'bank', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM accounts WHERE company_id = v_company_id AND code = '1020') THEN
    INSERT INTO accounts (company_id, code, name, type, is_active) VALUES (v_company_id, '1020', 'Mobile Wallet', 'mobile_wallet', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM accounts WHERE company_id = v_company_id AND code = '1100') THEN
    INSERT INTO accounts (company_id, code, name, type, is_active) VALUES (v_company_id, '1100', 'Accounts Receivable', 'asset', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM accounts WHERE company_id = v_company_id AND code = '2000') THEN
    INSERT INTO accounts (company_id, code, name, type, is_active) VALUES (v_company_id, '2000', 'Accounts Payable', 'liability', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM accounts WHERE company_id = v_company_id AND code = '5000') THEN
    INSERT INTO accounts (company_id, code, name, type, is_active) VALUES (v_company_id, '5000', 'Operating Expense', 'expense', true);
  END IF;

  IF p_modules IS NOT NULL AND jsonb_array_length(p_modules) > 0 THEN
    FOR v_module IN SELECT jsonb_array_elements_text(p_modules)
    LOOP
      v_module := NULLIF(TRIM(v_module), '');
      IF v_module IS NOT NULL THEN
        INSERT INTO modules_config (company_id, module_name, is_enabled, created_at, updated_at)
        VALUES (v_company_id, v_module, true, NOW(), NOW())
        ON CONFLICT (company_id, module_name) DO UPDATE SET is_enabled = true, updated_at = NOW();
      END IF;
    END LOOP;
  END IF;

  v_result := json_build_object('success', true, 'userId', v_user_id, 'companyId', v_company_id, 'branchId', v_branch_id);
  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$body$;
$m60$;
  RAISE NOTICE '60: create_business_transaction updated to set auth_user_id in users insert.';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '60: Could not replace create_business_transaction (auth_user_id column may not exist). Run identity migration first: %', SQLERRM;
END $$;

DO $$
BEGIN
  GRANT EXECUTE ON FUNCTION create_business_transaction(TEXT, TEXT, TEXT, TEXT, UUID, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;
  GRANT EXECUTE ON FUNCTION create_business_transaction(TEXT, TEXT, TEXT, TEXT, UUID, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '60: Grants skipped: %', SQLERRM;
END $$;
