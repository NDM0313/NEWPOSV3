-- Studio productions SELECT: align with permission engine (view_company / view_branch / view_own via sale creator).
-- Replaces company-only select policy from studio_productions_rls_company_scoped.sql.

DROP POLICY IF EXISTS "studio_productions_select_company" ON public.studio_productions;

CREATE POLICY "studio_productions_select_scoped"
  ON public.studio_productions FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      is_owner_or_admin()
      OR has_permission('studio', 'view_company')
      OR (
        has_permission('studio', 'view_branch')
        AND NOT has_permission('studio', 'view_company')
        AND (
          branch_id IS NULL
          OR EXISTS (
            SELECT 1 FROM public.user_branches ub
            WHERE ub.user_id = auth.uid() AND ub.branch_id = studio_productions.branch_id
          )
        )
      )
      OR (
        has_permission('studio', 'view_own')
        AND NOT has_permission('studio', 'view_company')
        AND NOT has_permission('studio', 'view_branch')
        AND EXISTS (
          SELECT 1 FROM public.sales s
          WHERE s.id = studio_productions.sale_id
            AND (s.created_by IS NULL OR s.created_by = auth.uid())
        )
      )
    )
  );

COMMENT ON POLICY "studio_productions_select_scoped" ON public.studio_productions IS
  'SELECT scoped by studio view_company / view_branch / view_own (sale.created_by for own).';
