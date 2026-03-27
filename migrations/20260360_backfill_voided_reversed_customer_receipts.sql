-- Backfill consistency: if a customer receipt JE has an active correction_reversal,
-- void linked payments and remove payment_allocations so LIVE ledger excludes them.

DO $$
BEGIN
  IF to_regclass('public.journal_entries') IS NULL OR to_regclass('public.payments') IS NULL THEN
    RAISE NOTICE 'journal_entries/payments missing; skip backfill';
    RETURN;
  END IF;

  -- 1) Void linked customer payments (manual_receipt / on_account) when original JE has active correction_reversal
  UPDATE public.payments p
  SET voided_at = COALESCE(p.voided_at, NOW())
  WHERE p.id IN (
    SELECT DISTINCT o.payment_id
    FROM public.journal_entries o
    JOIN public.journal_entries r
      ON r.reference_type = 'correction_reversal'
     AND r.reference_id = o.id
     AND COALESCE(r.is_void, FALSE) = FALSE
    WHERE o.payment_id IS NOT NULL
      AND COALESCE(o.is_void, FALSE) = FALSE
  )
    AND p.reference_type IN ('manual_receipt', 'on_account')
    AND p.voided_at IS NULL;

  -- 2) Remove allocations for voided payments (recalc trigger on payment_allocations handles sale due)
  IF to_regclass('public.payment_allocations') IS NOT NULL THEN
    DELETE FROM public.payment_allocations pa
    USING public.payments p
    WHERE pa.payment_id = p.id
      AND p.voided_at IS NOT NULL;
  END IF;
END $$;

