-- Ensure quick-login auth users (admin, info, demo) have public.users rows.
-- Fixes: "User profile not found. Create a business in the web app first."
-- Run on every deploy so new auth users get linked.

DO $$
DECLARE
  v_company_id UUID;
  v_branch_id UUID;
  r RECORD;
BEGIN
  SELECT id INTO v_company_id FROM public.companies WHERE is_active = true LIMIT 1;
  IF v_company_id IS NULL THEN
    SELECT id INTO v_company_id FROM public.companies LIMIT 1;
  END IF;
  IF v_company_id IS NULL THEN
    RETURN; -- No company yet, skip
  END IF;

  SELECT id INTO v_branch_id FROM public.branches WHERE company_id = v_company_id AND is_active = true LIMIT 1;

  FOR r IN
    SELECT au.id AS auth_id, au.email
    FROM auth.users au
    WHERE au.email IN ('admin@dincouture.pk', 'info@dincouture.pk', 'demo@dincollection.com', 'ndm313@yahoo.com')
      AND NOT EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = au.id OR u.auth_user_id = au.id
      )
  LOOP
    INSERT INTO public.users (id, company_id, email, full_name, role, is_active, auth_user_id)
    VALUES (
      r.auth_id,
      v_company_id,
      r.email,
      CASE r.email
        WHEN 'admin@dincouture.pk' THEN 'Admin'
        WHEN 'info@dincouture.pk' THEN 'Info'
        WHEN 'demo@dincollection.com' THEN 'Demo'
        ELSE 'User'
      END,
      'admin',
      true,
      r.auth_id
    )
    ON CONFLICT (id) DO UPDATE SET
      auth_user_id = EXCLUDED.auth_user_id,
      company_id = EXCLUDED.company_id,
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      role = EXCLUDED.role,
      is_active = EXCLUDED.is_active;

    IF v_branch_id IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_branches') THEN
      INSERT INTO public.user_branches (user_id, branch_id, is_default)
      VALUES (r.auth_id, v_branch_id, true)
      ON CONFLICT (user_id, branch_id) DO UPDATE SET is_default = true;
    END IF;
  END LOOP;
END $$;
