-- ============================================================================
-- Sales visibility: enforce mutually exclusive scope (OWN | BRANCH | COMPANY).
-- UI sends only one; this RLS uses priority so even bad data behaves correctly.
-- Priority: view_company > view_branch > view_own.
-- ============================================================================

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_select_policy" ON public.sales;

CREATE POLICY "sales_select_policy"
  ON public.sales FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      is_owner_or_admin()
      -- Mutually exclusive visibility (priority: company > branch > own)
      OR (has_permission('sales', 'view_company'))
      OR (
        has_permission('sales', 'view_branch')
        AND NOT has_permission('sales', 'view_company')
        AND (branch_id IS NULL OR EXISTS (
          SELECT 1 FROM public.user_branches ub
          WHERE ub.user_id = auth.uid() AND ub.branch_id = sales.branch_id
        ))
      )
      OR (
        has_permission('sales', 'view_own')
        AND NOT has_permission('sales', 'view_company')
        AND NOT has_permission('sales', 'view_branch')
        AND created_by = auth.uid()
      )
    )
  );

COMMENT ON POLICY "sales_select_policy" ON public.sales IS 'Sales visibility: one of OWN (created_by=me), BRANCH (assigned branches), COMPANY (all). Priority enforced so only one scope applies.';
