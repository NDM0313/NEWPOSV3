-- ============================================================================
-- PAYMENTS RLS: Allow authenticated users to SELECT/INSERT/UPDATE payments
-- Fixes: 403 "new row violates row-level security policy for table 'payments'"
-- when recording Receive Payment from Customer.
-- ============================================================================

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies (names from supabase-extract or custom)
DROP POLICY IF EXISTS "Users can view payments" ON public.payments;
DROP POLICY IF EXISTS "Users can insert payments" ON public.payments;
DROP POLICY IF EXISTS "payments_select_enterprise" ON public.payments;
DROP POLICY IF EXISTS "payments_insert_enterprise" ON public.payments;
DROP POLICY IF EXISTS "payments_update_enterprise" ON public.payments;
DROP POLICY IF EXISTS "payments_delete_enterprise" ON public.payments;

-- SELECT: same company, and branch_id is null or user has branch access
CREATE POLICY "payments_select_enterprise"
  ON public.payments FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (branch_id IS NULL OR has_branch_access(branch_id))
  );

-- INSERT: same company, and branch_id is null or user has branch access
CREATE POLICY "payments_insert_enterprise"
  ON public.payments FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_user_company_id()
    AND (branch_id IS NULL OR has_branch_access(branch_id))
  );

-- UPDATE: same as SELECT (user can update payments they can see)
CREATE POLICY "payments_update_enterprise"
  ON public.payments FOR UPDATE TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (branch_id IS NULL OR has_branch_access(branch_id))
  )
  WITH CHECK (
    company_id = get_user_company_id()
    AND (branch_id IS NULL OR has_branch_access(branch_id))
  );

-- DELETE: same as SELECT (user can delete payments they can see)
CREATE POLICY "payments_delete_enterprise"
  ON public.payments FOR DELETE TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (branch_id IS NULL OR has_branch_access(branch_id))
  );

COMMENT ON TABLE public.payments IS 'Payment records. RLS: authenticated users can CRUD payments for their company and branches they have access to.';
