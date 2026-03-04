-- ============================================================================
-- FIX: Purchases (and rentals, expenses) RLS user identity mismatch
-- ============================================================================
-- 1. user_branches.user_id REFERENCES public.users(id) (ERP user UUID).
-- 2. auth.uid() returns auth.users.id (auth UUID).
-- 3. Policies that used "users WHERE id = auth.uid()" never matched when
--    the app links users via users.auth_user_id = auth.uid().
--
-- This migration corrects company-scoped RLS to resolve the current user
-- by auth_user_id (using get_user_company_id() which already supports both).
-- It does NOT disable RLS or relax security.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Purchases: replace inline (users WHERE id = auth.uid()) with get_user_company_id()
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "purchases_select_company" ON public.purchases;
CREATE POLICY "purchases_select_company"
  ON public.purchases FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

DROP POLICY IF EXISTS "purchases_insert_company" ON public.purchases;
CREATE POLICY "purchases_insert_company"
  ON public.purchases FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS "purchases_update_company" ON public.purchases;
CREATE POLICY "purchases_update_company"
  ON public.purchases FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS "purchases_delete_company" ON public.purchases;
CREATE POLICY "purchases_delete_company"
  ON public.purchases FOR DELETE TO authenticated
  USING (company_id = get_user_company_id());

-- ----------------------------------------------------------------------------
-- Rentals: same fix (same pattern in 43_enable_rls_purchases_rentals_expenses)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "rentals_select_company" ON public.rentals;
CREATE POLICY "rentals_select_company"
  ON public.rentals FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

DROP POLICY IF EXISTS "rentals_insert_company" ON public.rentals;
CREATE POLICY "rentals_insert_company"
  ON public.rentals FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS "rentals_update_company" ON public.rentals;
CREATE POLICY "rentals_update_company"
  ON public.rentals FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS "rentals_delete_company" ON public.rentals;
CREATE POLICY "rentals_delete_company"
  ON public.rentals FOR DELETE TO authenticated
  USING (company_id = get_user_company_id());

-- ----------------------------------------------------------------------------
-- Expenses: same fix
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "expenses_select_company" ON public.expenses;
CREATE POLICY "expenses_select_company"
  ON public.expenses FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

DROP POLICY IF EXISTS "expenses_insert_company" ON public.expenses;
CREATE POLICY "expenses_insert_company"
  ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS "expenses_update_company" ON public.expenses;
CREATE POLICY "expenses_update_company"
  ON public.expenses FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS "expenses_delete_company" ON public.expenses;
CREATE POLICY "expenses_delete_company"
  ON public.expenses FOR DELETE TO authenticated
  USING (company_id = get_user_company_id());

-- ----------------------------------------------------------------------------
-- has_branch_access / get_user_branch_id: resolve via users.auth_user_id
-- (user_branches.user_id = public.users.id, so we must join to auth.uid())
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_branch_access(branch_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_branches ub
    JOIN public.users u ON u.id = ub.user_id
    WHERE u.auth_user_id = auth.uid() AND ub.branch_id = branch_uuid
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_branch_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT ub.branch_id FROM public.user_branches ub JOIN public.users u ON u.id = ub.user_id WHERE u.auth_user_id = auth.uid() AND ub.is_default = true LIMIT 1),
    (SELECT ub.branch_id FROM public.user_branches ub JOIN public.users u ON u.id = ub.user_id WHERE u.auth_user_id = auth.uid() LIMIT 1)
  );
$$;

-- ============================================================================
