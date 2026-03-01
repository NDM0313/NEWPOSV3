-- ============================================================================
-- Fix: Salesman should see only their own sales (created_by = auth.uid()), not all sales in branch.
-- Run on VPS: fixes test2 (salesman) seeing other users' sales.
-- ============================================================================

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_select_policy" ON public.sales;
CREATE POLICY "sales_select_policy"
  ON public.sales FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      is_admin_or_owner()
      OR (COALESCE(get_user_role()::text, '') IN ('manager', 'accountant') AND (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = sales.branch_id)))
      OR (created_by = auth.uid() AND (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = sales.branch_id)))
    )
  );

DROP POLICY IF EXISTS "sales_insert_policy" ON public.sales;
CREATE POLICY "sales_insert_policy"
  ON public.sales FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_user_company_id()
    AND (
      is_admin_or_owner()
      OR (COALESCE(get_user_role()::text, '') IN ('manager', 'accountant') AND (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = branch_id)))
      OR ((created_by IS NULL OR created_by = auth.uid()) AND (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = branch_id)))
    )
  );

DROP POLICY IF EXISTS "sales_update_policy" ON public.sales;
CREATE POLICY "sales_update_policy"
  ON public.sales FOR UPDATE TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      is_admin_or_owner()
      OR (COALESCE(get_user_role()::text, '') IN ('manager', 'accountant') AND (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = sales.branch_id)))
      OR (created_by = auth.uid() AND (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = sales.branch_id)))
    )
  )
  WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS "sales_delete_policy" ON public.sales;
CREATE POLICY "sales_delete_policy"
  ON public.sales FOR DELETE TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      is_admin_or_owner()
      OR (COALESCE(get_user_role()::text, '') IN ('manager', 'accountant') AND (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = sales.branch_id)))
      OR (created_by = auth.uid() AND (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = sales.branch_id)))
    )
  );
