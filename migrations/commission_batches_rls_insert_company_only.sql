-- ============================================================================
-- COMMISSION_BATCHES RLS: Company-only (fix 403 on Post Commission and GET)
-- Use when "new row violates row-level security policy" or 403 on commission_batches.
-- All three policies: only require company_id match (no branch check).
-- ============================================================================

ALTER TABLE public.commission_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "commission_batches_select_company" ON public.commission_batches;
DROP POLICY IF EXISTS "commission_batches_insert_company" ON public.commission_batches;
DROP POLICY IF EXISTS "commission_batches_update_company" ON public.commission_batches;

-- Helper: user's company_id from public.users (auth_user_id or id = auth.uid())
-- SELECT: same company so user can see inserted row and list batches
CREATE POLICY "commission_batches_select_company"
  ON public.commission_batches FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT company_id FROM public.users WHERE auth_user_id = auth.uid() OR id = auth.uid())
  );

-- INSERT: same company so Post Commission works
CREATE POLICY "commission_batches_insert_company"
  ON public.commission_batches FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (SELECT company_id FROM public.users WHERE auth_user_id = auth.uid() OR id = auth.uid())
  );

-- UPDATE: same company (e.g. set journal_entry_id after creating JE)
CREATE POLICY "commission_batches_update_company"
  ON public.commission_batches FOR UPDATE TO authenticated
  USING (company_id IN (SELECT company_id FROM public.users WHERE auth_user_id = auth.uid() OR id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE auth_user_id = auth.uid() OR id = auth.uid()));

COMMENT ON TABLE public.commission_batches IS 'Commission batches. RLS: company-only (no branch check) for SELECT/INSERT/UPDATE.';
