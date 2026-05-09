-- ============================================================================
-- One-shot repair: PAYMENT erp_document_sequences sentinel vs payments + branches
-- ============================================================================
-- Aligns company-level sentinel (00000000-0000-0000-0000-000000000000) last_number
-- with (a) max numeric suffix observed in payments (same rules as generate_document_number)
-- and (b) max(last_number) across all PAYMENT rows for that company/year.
-- Run after company-scoped PAY numbering (20260509190000) to avoid long unique_violation
-- streaks when switching from per-branch counters.

DO $$
DECLARE
  r RECORD;
  v_pay_max BIGINT;
  v_seq_max INTEGER;
  v_target INTEGER;
  v_sentinel UUID := public.erp_numbering_global_branch_sentinel();
BEGIN
  FOR r IN
    SELECT DISTINCT eds.company_id, eds.year
    FROM public.erp_document_sequences eds
    WHERE eds.document_type = 'PAYMENT'
  LOOP
    SELECT COALESCE(MAX(CAST(SUBSTRING(p.reference_number FROM '([0-9]+)$') AS BIGINT)), 0)
      INTO v_pay_max
    FROM public.payments p
    WHERE p.company_id = r.company_id
      AND p.reference_number ~ '([0-9]+)$'
      AND p.reference_number NOT ILIKE 'PAY-BACKFILL-%'
      AND LENGTH(SUBSTRING(p.reference_number FROM '([0-9]+)$')) <= 9;

    SELECT COALESCE(MAX(eds.last_number), 0)
      INTO v_seq_max
    FROM public.erp_document_sequences eds
    WHERE eds.company_id = r.company_id
      AND eds.document_type = 'PAYMENT'
      AND eds.year = r.year;

    -- INTEGER columns; clamp observed suffix into INTEGER range
    v_target := GREATEST(
      LEAST(v_pay_max, 2147483647)::INTEGER,
      v_seq_max
    );

    INSERT INTO public.erp_document_sequences (
      company_id, branch_id, document_type, prefix, year, last_number, padding, updated_at
    )
    VALUES (
      r.company_id,
      v_sentinel,
      'PAYMENT',
      public.erp_document_default_prefix('payment'),
      r.year,
      v_target,
      4,
      now()
    )
    ON CONFLICT (company_id, branch_id, document_type, year)
    DO UPDATE SET
      last_number = GREATEST(public.erp_document_sequences.last_number, EXCLUDED.last_number),
      updated_at = now();
  END LOOP;
END $$;
