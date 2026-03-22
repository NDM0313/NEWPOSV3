-- ============================================================================
-- Phase 4 — Auto-apply payment ↔ journal_entries linkage repair (P3 → P6)
--
-- Prerequisite: 20260340_historical_payment_je_linkage_repair.sql (audit table).
--
-- Runs once per deploy: idempotent WHERE clauses (re-run updates 0 rows when
-- already fixed). Logs each wave to je_payment_linkage_repair_audit with fresh
-- UUIDs; RAISE NOTICE prints batch ids for rollback (PART 7 in playbook).
--
-- No DELETE. Only UPDATE journal_entries + INSERT audit rows.
-- ============================================================================

DO $$
DECLARE
  b_p3 uuid := gen_random_uuid();
  b_p4 uuid := gen_random_uuid();
  b_p5 uuid := gen_random_uuid();
  b_p6 uuid := gen_random_uuid();
  n_p3 int;
  n_p4 int;
  n_p5 int;
  n_p6 int;
BEGIN
  -- P3: reference_id = payment_id (payment-type JE)
  INSERT INTO public.je_payment_linkage_repair_audit (
    repair_batch_id, company_id, journal_entry_id, bucket,
    old_payment_id, old_reference_id, new_payment_id, new_reference_id, note
  )
  SELECT
    b_p3,
    je.company_id,
    je.id,
    'P3_ref_from_payment_id',
    je.payment_id::text,
    je.reference_id::text,
    je.payment_id::text,
    je.payment_id::text,
    'AUTO: Set reference_id = payment_id for payment-type JE'
  FROM public.journal_entries je
  WHERE COALESCE(je.is_void, false) = false
    AND LOWER(TRIM(COALESCE(je.reference_type, ''))) IN ('payment', 'payment_adjustment')
    AND je.payment_id IS NOT NULL
    AND je.reference_id IS NULL
    AND EXISTS (SELECT 1 FROM public.payments p WHERE p.id = je.payment_id);
  GET DIAGNOSTICS n_p3 = ROW_COUNT;

  UPDATE public.journal_entries je
  SET reference_id = je.payment_id
  WHERE COALESCE(je.is_void, false) = false
    AND LOWER(TRIM(COALESCE(je.reference_type, ''))) IN ('payment', 'payment_adjustment')
    AND je.payment_id IS NOT NULL
    AND je.reference_id IS NULL
    AND EXISTS (SELECT 1 FROM public.payments p WHERE p.id = je.payment_id);

  -- P4: payment_id = reference_id when reference_id is payments.id
  INSERT INTO public.je_payment_linkage_repair_audit (
    repair_batch_id, company_id, journal_entry_id, bucket,
    old_payment_id, old_reference_id, new_payment_id, new_reference_id, note
  )
  SELECT
    b_p4,
    je.company_id,
    je.id,
    'P4_payment_id_from_reference_id',
    je.payment_id::text,
    je.reference_id::text,
    je.reference_id::text,
    je.reference_id::text,
    'AUTO: Set payment_id = reference_id when reference_id is a payments row'
  FROM public.journal_entries je
  WHERE COALESCE(je.is_void, false) = false
    AND LOWER(TRIM(COALESCE(je.reference_type, ''))) IN ('payment', 'payment_adjustment')
    AND je.reference_id IS NOT NULL
    AND je.payment_id IS NULL
    AND EXISTS (SELECT 1 FROM public.payments p WHERE p.id = je.reference_id)
    AND NOT EXISTS (
      SELECT 1
      FROM public.journal_entries j2
      WHERE j2.payment_id = je.reference_id
        AND j2.id <> je.id
        AND COALESCE(j2.is_void, false) = false
    );
  GET DIAGNOSTICS n_p4 = ROW_COUNT;

  UPDATE public.journal_entries je
  SET payment_id = je.reference_id
  WHERE COALESCE(je.is_void, false) = false
    AND LOWER(TRIM(COALESCE(je.reference_type, ''))) IN ('payment', 'payment_adjustment')
    AND je.reference_id IS NOT NULL
    AND je.payment_id IS NULL
    AND EXISTS (SELECT 1 FROM public.payments p WHERE p.id = je.reference_id)
    AND NOT EXISTS (
      SELECT 1
      FROM public.journal_entries j2
      WHERE j2.payment_id = je.reference_id
        AND j2.id <> je.id
        AND COALESCE(j2.is_void, false) = false
    );

  -- P5: sale/purchase payment JE — reference_id from payments.reference_id
  INSERT INTO public.je_payment_linkage_repair_audit (
    repair_batch_id, company_id, journal_entry_id, bucket,
    old_payment_id, old_reference_id, new_payment_id, new_reference_id, note
  )
  SELECT
    b_p5,
    je.company_id,
    je.id,
    'P5_doc_ref_from_payment',
    je.payment_id::text,
    je.reference_id::text,
    je.payment_id::text,
    p.reference_id::text,
    'AUTO: Fill document reference_id from payments row'
  FROM public.journal_entries je
  JOIN public.payments p ON p.id = je.payment_id
  WHERE COALESCE(je.is_void, false) = false
    AND je.reference_id IS NULL
    AND je.payment_id IS NOT NULL
    AND LOWER(TRIM(COALESCE(je.reference_type, ''))) IN ('sale', 'purchase')
    AND p.reference_id IS NOT NULL;
  GET DIAGNOSTICS n_p5 = ROW_COUNT;

  UPDATE public.journal_entries je
  SET reference_id = p.reference_id
  FROM public.payments p
  WHERE p.id = je.payment_id
    AND COALESCE(je.is_void, false) = false
    AND je.reference_id IS NULL
    AND je.payment_id IS NOT NULL
    AND LOWER(TRIM(COALESCE(je.reference_type, ''))) IN ('sale', 'purchase')
    AND p.reference_id IS NOT NULL;

  -- P6: heuristic unique match (temp table, ON COMMIT DROP)
  CREATE TEMP TABLE tmp_phase4_je_pay_unique ON COMMIT DROP AS
  WITH je_amount AS (
    SELECT
      je.id AS je_id,
      je.company_id,
      je.branch_id,
      je.entry_date,
      COALESCE(SUM(jel.debit), 0) AS total_debit
    FROM public.journal_entries je
    JOIN public.journal_entry_lines jel ON jel.journal_entry_id = je.id
    WHERE COALESCE(je.is_void, false) = false
      AND LOWER(TRIM(COALESCE(je.reference_type, ''))) = 'payment'
      AND je.payment_id IS NULL
      AND je.reference_id IS NULL
    GROUP BY je.id, je.company_id, je.branch_id, je.entry_date
    HAVING ABS(COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0)) < 0.02
      AND COUNT(*) = 2
  ),
  candidates AS (
    SELECT
      j.je_id,
      p.id AS payment_id,
      COUNT(*) OVER (PARTITION BY j.je_id) AS match_count_for_je,
      COUNT(*) OVER (PARTITION BY p.id) AS match_count_for_payment
    FROM je_amount j
    JOIN public.payments p
      ON p.company_id = j.company_id
      AND ABS(COALESCE(p.amount, 0) - j.total_debit) < 0.02
      AND p.payment_date IS NOT NULL
      AND j.entry_date IS NOT NULL
      AND p.payment_date BETWEEN (j.entry_date - 2) AND (j.entry_date + 2)
      AND (j.branch_id IS NULL OR p.branch_id IS NULL OR p.branch_id = j.branch_id)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.journal_entries x
      WHERE x.payment_id = p.id
        AND COALESCE(x.is_void, false) = false
    )
  )
  SELECT je_id, payment_id
  FROM candidates
  WHERE match_count_for_je = 1
    AND match_count_for_payment = 1;

  INSERT INTO public.je_payment_linkage_repair_audit (
    repair_batch_id, company_id, journal_entry_id, bucket,
    old_payment_id, old_reference_id, new_payment_id, new_reference_id, note
  )
  SELECT
    b_p6,
    je.company_id,
    t.je_id,
    'P6_heuristic_unique',
    je.payment_id::text,
    je.reference_id::text,
    t.payment_id::text,
    t.payment_id::text,
    'AUTO: Linked orphan payment-type JE to sole matching payments row'
  FROM tmp_phase4_je_pay_unique t
  JOIN public.journal_entries je ON je.id = t.je_id;
  GET DIAGNOSTICS n_p6 = ROW_COUNT;

  UPDATE public.journal_entries je
  SET
    payment_id = t.payment_id,
    reference_id = t.payment_id
  FROM tmp_phase4_je_pay_unique t
  WHERE je.id = t.je_id;

  RAISE NOTICE 'phase4_payment_je_repair: P3 audit rows=%, batch=%', n_p3, b_p3;
  RAISE NOTICE 'phase4_payment_je_repair: P4 audit rows=%, batch=%', n_p4, b_p4;
  RAISE NOTICE 'phase4_payment_je_repair: P5 audit rows=%, batch=%', n_p5, b_p5;
  RAISE NOTICE 'phase4_payment_je_repair: P6 audit rows=%, batch=%', n_p6, b_p6;
END $$;
