-- ============================================================================
-- COMMISSION_BATCHES RLS (inline company/branch — no dependency on helper functions)
-- Use this if commission_batches_rls_company_scoped.sql still gives 403 (e.g. get_user_company_id not found).
-- Policies use inline subqueries so they work without get_user_company_id/has_branch_access.
-- ============================================================================

ALTER TABLE public.commission_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "commission_batches_select_company" ON public.commission_batches;
DROP POLICY IF EXISTS "commission_batches_insert_company" ON public.commission_batches;
DROP POLICY IF EXISTS "commission_batches_update_company" ON public.commission_batches;

-- Company match: user's company from users (id or auth_user_id = auth.uid())
-- Branch match: branch_id is null OR user has row in user_branches for that branch
CREATE POLICY "commission_batches_select_company"
  ON public.commission_batches FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid() OR auth_user_id = auth.uid())
    AND (
      branch_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.user_branches ub
        JOIN public.users u ON u.id = ub.user_id
        WHERE ub.branch_id = commission_batches.branch_id
          AND (u.id = auth.uid() OR u.auth_user_id = auth.uid())
      )
    )
  );

CREATE POLICY "commission_batches_insert_company"
  ON public.commission_batches FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid() OR auth_user_id = auth.uid())
    AND (
      branch_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.user_branches ub
        JOIN public.users u ON u.id = ub.user_id
        WHERE ub.branch_id = commission_batches.branch_id
          AND (u.id = auth.uid() OR u.auth_user_id = auth.uid())
      )
    )
  );

CREATE POLICY "commission_batches_update_company"
  ON public.commission_batches FOR UPDATE TO authenticated
  USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid() OR auth_user_id = auth.uid())
  )
  WITH CHECK (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid() OR auth_user_id = auth.uid())
  );

COMMENT ON TABLE public.commission_batches IS 'One batch per Post Commission. RLS: inline company/branch for authenticated users.';
