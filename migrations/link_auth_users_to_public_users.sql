-- ============================================================================
-- LINK AUTH USERS TO PUBLIC.USERS
-- ============================================================================
-- Fixes: "User profile not found. Create a business in the web app first."
-- Fixes: GET /rest/v1/users 500 - auth user exists but not in public.users
-- Links ALL auth.users to public.users (company_id, role) so mobile app works.
-- ============================================================================

DO $$
DECLARE
  v_company_id UUID;
  v_branch_id UUID;
  v_auth_id UUID;
  v_email TEXT;
  v_name TEXT;
  v_linked INT := 0;
BEGIN
  SELECT id INTO v_company_id FROM companies WHERE is_active = true LIMIT 1;
  IF v_company_id IS NULL THEN
    SELECT id INTO v_company_id FROM companies LIMIT 1;
  END IF;
  IF v_company_id IS NULL THEN
    RAISE NOTICE 'No company found. Skip linking auth users.';
    RETURN;
  END IF;

  SELECT id INTO v_branch_id FROM branches WHERE company_id = v_company_id LIMIT 1;

  FOR v_auth_id, v_email, v_name IN
    SELECT au.id, au.email, COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', split_part(au.email, '@', 1))
    FROM auth.users au
    WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = au.id)
  LOOP
    INSERT INTO public.users (id, company_id, email, full_name, role, is_active)
    VALUES (v_auth_id, v_company_id, COALESCE(v_email, 'user@unknown'), COALESCE(v_name, 'User'), 'admin', true)
    ON CONFLICT (id) DO UPDATE SET
      company_id = EXCLUDED.company_id,
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      role = EXCLUDED.role,
      is_active = EXCLUDED.is_active;
    v_linked := v_linked + 1;

    IF v_branch_id IS NOT NULL THEN
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_branches') THEN
          INSERT INTO public.user_branches (user_id, branch_id, is_default)
          VALUES (v_auth_id, v_branch_id, true)
          ON CONFLICT (user_id, branch_id) DO UPDATE SET is_default = true;
        END IF;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
  END LOOP;

  IF v_linked > 0 THEN
    RAISE NOTICE 'Linked % auth user(s) to public.users', v_linked;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'link_auth_users: %', SQLERRM;
END $$;
