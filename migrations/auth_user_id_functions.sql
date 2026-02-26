-- Update get_user_company_id and get_user_role to support auth_user_id lookup
-- Runs after auth_user_id_and_user_auth_link. May fail if function signatures differ - safe to skip.

DO $$ BEGIN
  CREATE OR REPLACE FUNCTION get_user_company_id()
  RETURNS UUID AS $fn$
    SELECT COALESCE(
      (SELECT company_id FROM public.users WHERE id = auth.uid() LIMIT 1),
      (SELECT company_id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1)
    );
  $fn$ LANGUAGE sql SECURITY DEFINER;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'auth_user_id_functions: get_user_company_id update skipped: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE OR REPLACE FUNCTION get_user_role()
  RETURNS TEXT AS $fn$
    SELECT COALESCE(
      (SELECT role::text FROM public.users WHERE id = auth.uid() LIMIT 1),
      (SELECT role::text FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1),
      'viewer'
    );
  $fn$ LANGUAGE sql SECURITY DEFINER;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'auth_user_id_functions: get_user_role update skipped: %', SQLERRM;
END $$;
