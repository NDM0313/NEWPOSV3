-- ============================================================================
-- PAYMENT_ALLOCATIONS RLS
-- Fixes: 403 "new row violates row-level security policy for table 'payment_allocations'"
-- when FIFO auto-allocation INSERT runs after a manual customer receipt.
--
-- Policies are scoped through public.payments: if the role can see the parent
-- payment (RLS on payments applies inside EXISTS), it can read/write allocations
-- for that payment. Same company_id as the payment row is required.
-- Works whether payments use has_branch_access, has_permission('payments',...),
-- or other enterprise variants — no duplicate policy logic.
-- ============================================================================

ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_allocations_select_enterprise" ON public.payment_allocations;
DROP POLICY IF EXISTS "payment_allocations_insert_enterprise" ON public.payment_allocations;
DROP POLICY IF EXISTS "payment_allocations_update_enterprise" ON public.payment_allocations;
DROP POLICY IF EXISTS "payment_allocations_delete_enterprise" ON public.payment_allocations;

-- SELECT: same company as JWT; parent payment must be visible under payments RLS
CREATE POLICY "payment_allocations_select_enterprise"
  ON public.payment_allocations FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id()
    AND EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.id = payment_allocations.payment_id
        AND p.company_id = payment_allocations.company_id
    )
  );

-- INSERT: user must already satisfy payments RLS for that payment row
CREATE POLICY "payment_allocations_insert_enterprise"
  ON public.payment_allocations FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_user_company_id()
    AND EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.id = payment_id
        AND p.company_id = company_id
    )
  );

CREATE POLICY "payment_allocations_update_enterprise"
  ON public.payment_allocations FOR UPDATE TO authenticated
  USING (
    company_id = get_user_company_id()
    AND EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.id = payment_allocations.payment_id
        AND p.company_id = payment_allocations.company_id
    )
  )
  WITH CHECK (
    company_id = get_user_company_id()
    AND EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.id = payment_id
        AND p.company_id = company_id
    )
  );

CREATE POLICY "payment_allocations_delete_enterprise"
  ON public.payment_allocations FOR DELETE TO authenticated
  USING (
    company_id = get_user_company_id()
    AND EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.id = payment_allocations.payment_id
        AND p.company_id = payment_allocations.company_id
    )
  );

COMMENT ON TABLE public.payment_allocations IS 'Allocates manual_receipt payment amounts to sales. RLS: tied to visible payments rows (same company).';
