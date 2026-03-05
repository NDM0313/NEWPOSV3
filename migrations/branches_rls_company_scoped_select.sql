-- ============================================================================
-- BRANCHES RLS: Company-scoped SELECT for all authenticated users
-- ============================================================================
-- PROBLEM: Non-admin users could not read branches (RLS blocked SELECT).
--         App saw 0 branches → auto-select failed, "No branch set up" / 403.
--
-- GOAL:   All authenticated users can SELECT branches for their company only.
--         INSERT/UPDATE/DELETE remain restricted to admin/owner.
--
-- DO NOT: Remove RLS, relax other tables, or change Web ERP logic.
-- ============================================================================

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- Drop existing SELECT policies (idempotent: safe to re-run)
DROP POLICY IF EXISTS "Users can view accessible branches" ON public.branches;
DROP POLICY IF EXISTS "branches_select_enterprise" ON public.branches;
DROP POLICY IF EXISTS "branches_select_company" ON public.branches;

-- SELECT: Any authenticated user can read branches of their company
CREATE POLICY "branches_select_company"
  ON public.branches FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- INSERT: Only admin/owner can create branches
DROP POLICY IF EXISTS "branches_insert_admin" ON public.branches;
CREATE POLICY "branches_insert_admin"
  ON public.branches FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_user_company_id()
    AND COALESCE(get_user_role()::text, '') IN ('owner', 'admin')
  );

-- UPDATE: Only admin/owner can update branches
DROP POLICY IF EXISTS "branches_update_admin" ON public.branches;
CREATE POLICY "branches_update_admin"
  ON public.branches FOR UPDATE TO authenticated
  USING (
    company_id = get_user_company_id()
    AND COALESCE(get_user_role()::text, '') IN ('owner', 'admin')
  )
  WITH CHECK (
    company_id = get_user_company_id()
    AND COALESCE(get_user_role()::text, '') IN ('owner', 'admin')
  );

-- DELETE: Only admin/owner can delete branches
DROP POLICY IF EXISTS "branches_delete_admin" ON public.branches;
CREATE POLICY "branches_delete_admin"
  ON public.branches FOR DELETE TO authenticated
  USING (
    company_id = get_user_company_id()
    AND COALESCE(get_user_role()::text, '') IN ('owner', 'admin')
  );

COMMENT ON POLICY "branches_select_company" ON public.branches IS 'All authenticated users can read company branches (fixes 0 branches for staff/salesman).';
COMMENT ON POLICY "branches_insert_admin" ON public.branches IS 'Only owner/admin can create branches.';
COMMENT ON POLICY "branches_update_admin" ON public.branches IS 'Only owner/admin can update branches.';
COMMENT ON POLICY "branches_delete_admin" ON public.branches IS 'Only owner/admin can delete branches.';
