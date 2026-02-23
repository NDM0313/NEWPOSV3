-- Link auth users to public.users so mobile app can fetch company_id/role.
-- Run in Supabase SQL Editor (erp.dincouture.pk) or: psql $DATABASE_URL -f deploy/link-mobile-auth-users.sql
--
-- Fixes: "User profile not found. Create a business in the web app first."
-- Cause: User exists in auth.users but not in public.users.

DO $$
DECLARE
  v_company_id UUID;
  v_branch_id UUID;
  v_auth_id UUID;
  v_email TEXT;
BEGIN
  SELECT id INTO v_company_id FROM companies WHERE is_active = true LIMIT 1;
  IF v_company_id IS NULL THEN
    SELECT id INTO v_company_id FROM companies LIMIT 1;
  END IF;
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'No company found. Create a business in the web app first.';
  END IF;

  SELECT id INTO v_branch_id FROM branches WHERE company_id = v_company_id LIMIT 1;

  -- Link ndm313@yahoo.com
  FOR v_auth_id, v_email IN
    SELECT id, email FROM auth.users WHERE email = 'ndm313@yahoo.com'
  LOOP
    INSERT INTO public.users (id, company_id, email, full_name, role, is_active)
    VALUES (v_auth_id, v_company_id, v_email, 'Main User', 'admin', true)
    ON CONFLICT (id) DO UPDATE SET
      company_id = EXCLUDED.company_id,
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      role = EXCLUDED.role,
      is_active = EXCLUDED.is_active;
    RAISE NOTICE 'Linked % to company %', v_email, v_company_id;

    IF v_branch_id IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_branches') THEN
      INSERT INTO public.user_branches (user_id, branch_id, is_default)
      VALUES (v_auth_id, v_branch_id, true)
      ON CONFLICT (user_id, branch_id) DO UPDATE SET is_default = true;
    END IF;
  END LOOP;

  -- Link admin@dincouture.pk
  FOR v_auth_id, v_email IN
    SELECT id, email FROM auth.users WHERE email = 'admin@dincouture.pk'
  LOOP
    INSERT INTO public.users (id, company_id, email, full_name, role, is_active)
    VALUES (v_auth_id, v_company_id, v_email, 'Admin', 'admin', true)
    ON CONFLICT (id) DO UPDATE SET
      company_id = EXCLUDED.company_id,
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      role = EXCLUDED.role,
      is_active = EXCLUDED.is_active;
    RAISE NOTICE 'Linked % to company %', v_email, v_company_id;

    IF v_branch_id IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_branches') THEN
      INSERT INTO public.user_branches (user_id, branch_id, is_default)
      VALUES (v_auth_id, v_branch_id, true)
      ON CONFLICT (user_id, branch_id) DO UPDATE SET is_default = true;
    END IF;
  END LOOP;

  RAISE NOTICE 'Done. Refresh mobile app and login again.';
END $$;
