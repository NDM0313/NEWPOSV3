-- ============================================================================
-- COMMISSION_BATCHES RLS: Company-scoped SELECT / INSERT / UPDATE
-- Fixes: 403 "new row violates row-level security policy for table commission_batches"
-- when using Post Commission from Reports → Commission.
-- ============================================================================

ALTER TABLE public.commission_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "commission_batches_select_company" ON public.commission_batches;
DROP POLICY IF EXISTS "commission_batches_insert_company" ON public.commission_batches;
DROP POLICY IF EXISTS "commission_batches_update_company" ON public.commission_batches;

-- SELECT: same company; branch_id null or user has branch access
CREATE POLICY "commission_batches_select_company"
  ON public.commission_batches FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (branch_id IS NULL OR has_branch_access(branch_id))
  );

-- INSERT: same company; branch_id null or user has branch access
CREATE POLICY "commission_batches_insert_company"
  ON public.commission_batches FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_user_company_id()
    AND (branch_id IS NULL OR has_branch_access(branch_id))
  );

-- UPDATE: same company (e.g. set journal_entry_id after creating JE)
CREATE POLICY "commission_batches_update_company"
  ON public.commission_batches FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

COMMENT ON TABLE public.commission_batches IS 'One batch per Post Commission action. RLS: company-scoped for authenticated users.';
