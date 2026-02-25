-- Fix recursive RLS on users table causing 500 on GET /rest/v1/users
-- The rls_fix_company policy uses (SELECT company_id FROM users WHERE id = auth.uid())
-- which reads users and retriggers RLS → infinite recursion.
-- Fix: add policy allowing users to read their own row (id = auth.uid()).
-- PostgreSQL ORs policies for the same command, so this breaks the recursion.

-- Ensure helper functions exist (SECURITY DEFINER bypasses RLS).
-- get_user_role returns TEXT so we never depend on user_role enum existing (works on all DBs).
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT COALESCE((SELECT role::text FROM public.users WHERE id = auth.uid()), 'viewer');
$$ LANGUAGE sql SECURITY DEFINER;

-- Drop the recursive policy on users
DROP POLICY IF EXISTS "rls_fix_company" ON public.users;

-- Add policy: users can read their own row (breaks recursion)
DROP POLICY IF EXISTS "users_read_own_row" ON public.users;
CREATE POLICY "users_read_own_row"
  ON public.users FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Add policy: users can read company users (uses SECURITY DEFINER, no recursion)
DROP POLICY IF EXISTS "users_read_company_users" ON public.users;
CREATE POLICY "users_read_company_users"
  ON public.users FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

-- Admins can manage users in their company
DROP POLICY IF EXISTS "admins_manage_users" ON public.users;
CREATE POLICY "admins_manage_users"
  ON public.users FOR ALL
  TO authenticated
  USING (
    get_user_role() = 'admin' AND company_id = get_user_company_id()
  )
  WITH CHECK (
    get_user_role() = 'admin' AND company_id = get_user_company_id()
  );

-- Users can update their own profile
DROP POLICY IF EXISTS "users_update_own_profile" ON public.users;
CREATE POLICY "users_update_own_profile"
  ON public.users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
