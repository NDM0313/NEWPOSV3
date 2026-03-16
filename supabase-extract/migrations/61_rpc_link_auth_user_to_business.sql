-- ============================================================================
-- Migration 61: RPC link_auth_user_to_business — one-click fix for "Create your business"
-- ============================================================================
-- When a user already created a business but public.users has no row (or no auth_user_id),
-- this RPC links the current auth user to the company that has their email.
-- Call from app when signed in and companyId is null (e.g. "Fix my account" button).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.link_auth_user_to_business()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id UUID;
  v_email TEXT;
  v_name TEXT;
  v_company_id UUID;
  v_branch_id UUID;
BEGIN
  v_auth_id := auth.uid();
  IF v_auth_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not signed in.');
  END IF;

  SELECT email, COALESCE(raw_user_meta_data->>'full_name', email)
  INTO v_email, v_name
  FROM auth.users
  WHERE id = v_auth_id
  LIMIT 1;

  IF v_email IS NULL OR TRIM(v_email) = '' THEN
    RETURN json_build_object('success', false, 'error', 'Auth user email not found.');
  END IF;

  SELECT id INTO v_company_id
  FROM public.companies
  WHERE LOWER(TRIM(email)) = LOWER(TRIM(v_email))
  LIMIT 1;

  -- Fallback: if no company by email, and there is exactly one company in the DB, link to it (single-tenant / dev)
  IF v_company_id IS NULL THEN
    SELECT id INTO v_company_id
    FROM public.companies
    WHERE is_active = true
    ORDER BY created_at
    LIMIT 1;
    IF v_company_id IS NOT NULL AND (SELECT COUNT(*) FROM public.companies WHERE is_active = true) > 1 THEN
      v_company_id := NULL;
    END IF;
  END IF;

  IF v_company_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'No business found for this email. Use the same email you used in Create New Business, or create a business first from the login page.',
      'email_looked_up', v_email
    );
  END IF;

  SELECT id INTO v_branch_id
  FROM public.branches
  WHERE company_id = v_company_id AND is_active = true
  ORDER BY created_at
  LIMIT 1;

  INSERT INTO public.users (id, company_id, email, full_name, role, is_active, auth_user_id)
  VALUES (v_auth_id, v_company_id, v_email, v_name, 'admin', true, v_auth_id)
  ON CONFLICT (id) DO UPDATE SET
    auth_user_id = EXCLUDED.auth_user_id,
    company_id = EXCLUDED.company_id,
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active;

  IF v_branch_id IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_branches') THEN
    INSERT INTO public.user_branches (user_id, branch_id, is_default)
    VALUES (v_auth_id, v_branch_id, true)
    ON CONFLICT (user_id, branch_id) DO UPDATE SET is_default = true;
  END IF;

  RETURN json_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_auth_user_to_business() TO authenticated;
COMMENT ON FUNCTION public.link_auth_user_to_business() IS 'Links current auth user to existing business by email. Use when user created business but sees Create your business after login.';
