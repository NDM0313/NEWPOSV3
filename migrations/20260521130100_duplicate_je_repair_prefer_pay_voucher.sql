-- ============================================================================
-- Correct duplicate-JE repair when created_at ties: prefer voucher PAY-* JE
-- ============================================================================
-- Prior repair used ROW_NUMBER(... created_at DESC, id DESC), which could keep a
-- legacy trigger JE (entry_no JE-*) and void the RPC voucher JE (document_no =
-- payments.reference_number). Reinstate the voucher JE and void the JE-* stub.

BEGIN;

UPDATE public.journal_entries je_good
SET
  is_void = FALSE,
  void_reason = NULL,
  voided_at = NULL
WHERE je_good.reference_type = 'payment'
  AND je_good.is_void = TRUE
  AND EXISTS (
    SELECT 1
    FROM public.payments p
    WHERE p.id = je_good.payment_id
      AND TRIM(COALESCE(je_good.document_no, '')) = TRIM(COALESCE(p.reference_number, ''))
  )
  AND EXISTS (
    SELECT 1
    FROM public.journal_entries je_bad
    WHERE je_bad.payment_id = je_good.payment_id
      AND je_bad.reference_type = 'payment'
      AND COALESCE(je_bad.is_void, FALSE) = FALSE
      AND TRIM(COALESCE(je_bad.entry_no, '')) LIKE 'JE-%'
  );

UPDATE public.journal_entries je_bad
SET
  is_void = TRUE,
  void_reason = 'Duplicate journal repair: superseded by PAY voucher JE (same payment_id)',
  voided_at = NOW()
WHERE je_bad.reference_type = 'payment'
  AND COALESCE(je_bad.is_void, FALSE) = FALSE
  AND TRIM(COALESCE(je_bad.entry_no, '')) LIKE 'JE-%'
  AND EXISTS (
    SELECT 1
    FROM public.payments p
    WHERE p.id = je_bad.payment_id
  )
  AND EXISTS (
    SELECT 1
    FROM public.journal_entries je_good
    WHERE je_good.payment_id = je_bad.payment_id
      AND je_good.reference_type = 'payment'
      AND COALESCE(je_good.is_void, FALSE) = FALSE
      AND TRIM(COALESCE(je_good.document_no, '')) = TRIM(COALESCE(
        (SELECT reference_number FROM public.payments WHERE id = je_bad.payment_id LIMIT 1),
        ''
      ))
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
