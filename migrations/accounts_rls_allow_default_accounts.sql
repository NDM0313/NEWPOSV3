-- ============================================================================
-- ACCOUNTS RLS: Allow creation of default accounts (Cash, Bank, Mobile Wallet)
-- Fixes: "new row violates row-level security policy for table accounts" (403)
-- when SupabaseContext / defaultAccountsService ensures mandatory accounts.
-- ============================================================================

-- Ensure RLS helpers exist. Must support both id = auth.uid() AND auth_user_id = auth.uid()
-- (public.users can be linked to auth via either column; see auth_user_id_and_user_auth_link.sql)
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT company_id FROM users WHERE id = auth.uid() LIMIT 1),
    (SELECT company_id FROM users WHERE auth_user_id = auth.uid() LIMIT 1)
  );
$$;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM users WHERE id = auth.uid() LIMIT 1),
    (SELECT role FROM users WHERE auth_user_id = auth.uid() LIMIT 1)
  )::user_role;
$$;

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies so we can define consistent ones (by known names)
-- rls_fix_company is from deploy/enable-rls-public-tables.sql; remove it so only our policies apply
DROP POLICY IF EXISTS "rls_fix_company" ON accounts;
DROP POLICY IF EXISTS "Accountants can view accounts" ON accounts;
DROP POLICY IF EXISTS "Admins and accountants can manage accounts" ON accounts;
DROP POLICY IF EXISTS "accounts_select_company" ON accounts;
DROP POLICY IF EXISTS "accounts_insert_company" ON accounts;
DROP POLICY IF EXISTS "accounts_update_company" ON accounts;
DROP POLICY IF EXISTS "accounts_delete_company" ON accounts;

-- SELECT: same company
CREATE POLICY "accounts_select_company"
  ON accounts FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- INSERT: same company (allows default account creation by app on init)
CREATE POLICY "accounts_insert_company"
  ON accounts FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id());

-- UPDATE: same company
CREATE POLICY "accounts_update_company"
  ON accounts FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

-- DELETE: same company
CREATE POLICY "accounts_delete_company"
  ON accounts FOR DELETE TO authenticated
  USING (company_id = get_user_company_id());

COMMENT ON TABLE accounts IS 'Chart of accounts. RLS: authenticated users can CRUD accounts for their company (get_user_company_id()).';
