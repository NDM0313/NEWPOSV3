-- ============================================================================
-- Fix: invalid input value for enum user_role: ""
-- Ensures get_user_role() never returns/casts empty string; optional data fix.
-- Safe to run multiple times. Run on VPS Supabase via deploy/apply-fix-user-role-enum-vps.sh
-- ============================================================================

-- 1) Fix function: never cast '' to user_role (use NULLIF+TRIM+COALESCE to 'viewer')
DO $$ BEGIN
  CREATE OR REPLACE FUNCTION public.get_user_role()
  RETURNS user_role LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $fn$
    SELECT COALESCE(
      NULLIF(TRIM((SELECT role::text FROM public.users WHERE id = auth.uid() LIMIT 1)), ''),
      NULLIF(TRIM((SELECT role::text FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1)), ''),
      'viewer'
    )::user_role;
  $fn$;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'get_user_role (user_role): %', SQLERRM;
END $$;

-- 2) Ensure no NULL role is read as empty: public schema uses public.users
-- (If your get_user_role lives in public and uses "users" unqualified, it uses public.users.)
