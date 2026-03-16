-- ============================================================================
-- One-time: Create business + user link when "No business found for this email"
-- ============================================================================
-- Use when you're logged in (e.g. ndm313@live.com) but no company exists with
-- that email — this creates the company, branch, and public.users row so you
-- can use the app.
--
-- 1. Set your email below in v_email.
-- 2. Run this entire script in Supabase SQL Editor (once).
-- 3. Sign out and sign in again in the app.
-- ============================================================================

DO $$
DECLARE
  v_email TEXT := 'ndm313@live.com';
  v_auth_id UUID;
  v_name TEXT;
  v_company_id UUID;
  v_branch_id UUID;
BEGIN
  SELECT id, COALESCE(raw_user_meta_data->>'full_name', email)
  INTO v_auth_id, v_name
  FROM auth.users
  WHERE LOWER(TRIM(email)) = LOWER(TRIM(v_email))
  LIMIT 1;

  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'No auth user found for email: %. Sign in once in the app, then run this script.', v_email;
  END IF;

  -- Find existing company by email
  SELECT id INTO v_company_id
  FROM public.companies
  WHERE LOWER(TRIM(email)) = LOWER(TRIM(v_email))
  LIMIT 1;

  -- If no company, create one + default branch
  IF v_company_id IS NULL THEN
    INSERT INTO public.companies (id, name, email, currency, is_active, created_at, updated_at)
    VALUES (gen_random_uuid(), 'My Business', v_email, 'PKR', true, NOW(), NOW())
    RETURNING id INTO v_company_id;

    INSERT INTO public.branches (id, company_id, name, code, is_active, created_at, updated_at)
    VALUES (gen_random_uuid(), v_company_id, 'Main Branch', 'HQ', true, NOW(), NOW())
    RETURNING id INTO v_branch_id;

    RAISE NOTICE 'Created company % and branch %', v_company_id, v_branch_id;
  ELSE
    SELECT id INTO v_branch_id
    FROM public.branches
    WHERE company_id = v_company_id AND is_active = true
    ORDER BY created_at
    LIMIT 1;
  END IF;

  -- Ensure user row exists and is linked
  INSERT INTO public.users (id, company_id, email, full_name, role, is_active, created_at, updated_at, auth_user_id)
  VALUES (v_auth_id, v_company_id, v_email, v_name, 'admin', true, NOW(), NOW(), v_auth_id)
  ON CONFLICT (id) DO UPDATE SET
    auth_user_id = EXCLUDED.auth_user_id,
    company_id = EXCLUDED.company_id,
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active;

  IF v_branch_id IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_branches') THEN
    INSERT INTO public.user_branches (user_id, branch_id, is_default, created_at)
    VALUES (v_auth_id, v_branch_id, true, NOW())
    ON CONFLICT (user_id, branch_id) DO UPDATE SET is_default = true;
  END IF;

  RAISE NOTICE 'Done. User % linked to company %. Sign out and sign in again.', v_auth_id, v_company_id;
END $$;
