-- Repair split-brain: JE voided (manual_void) but payments.voided_at still NULL.
-- Safe: UPDATE payments only where mismatch; uses JE voided_at timestamp.

UPDATE public.payments p
SET voided_at = COALESCE(p.voided_at, je.voided_at, je.created_at, now())
FROM (
  SELECT DISTINCT ON (je.payment_id)
    je.payment_id,
    je.voided_at,
    je.created_at
  FROM public.journal_entries je
  WHERE je.payment_id IS NOT NULL
    AND COALESCE(je.is_void, false) = true
    AND lower(COALESCE(je.reference_type, '')) IN ('payment', 'worker_payment', 'sale', 'manual_receipt')
  ORDER BY je.payment_id, je.voided_at DESC NULLS LAST, je.created_at DESC
) je
WHERE p.id = je.payment_id
  AND p.voided_at IS NULL;

NOTIFY pgrst, 'reload schema';
