-- ============================================================================
-- Dev invariant helper: payment_has_active_journal_for_company
-- ============================================================================
-- Client SELECT on journal_entries is blocked by enterprise RLS for some users
-- even when record_payment_with_accounting inserted the JE. SECURITY DEFINER
-- check scoped by get_user_company_id() avoids false-positive PAYMENT_POSTING_INVARIANT.

CREATE OR REPLACE FUNCTION public.payment_has_active_journal_for_company(p_payment_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.journal_entries je
    INNER JOIN public.payments p ON p.id = je.payment_id
    WHERE je.payment_id = p_payment_id
      AND p.company_id = public.get_user_company_id()
      AND (je.is_void IS NULL OR je.is_void = false)
  );
$$;

COMMENT ON FUNCTION public.payment_has_active_journal_for_company(UUID) IS
  'True when an active (non-void) journal entry exists for the payment in the caller company; bypasses journal_entries RLS for dev invariant checks.';

GRANT EXECUTE ON FUNCTION public.payment_has_active_journal_for_company(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
