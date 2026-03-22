-- ============================================================================
-- PHASE 3 — Payment JE linkage: detection, dry-run, APPLY, rollback
--
-- Prerequisite: migration 20260340_historical_payment_je_linkage_repair.sql
--   (creates public.je_payment_linkage_repair_audit).
--
-- Posting contract: payment-type JEs use payments.id for both payment_id and
-- reference_id when both are populated; sale/purchase receipt JEs use
-- reference_id = document id and payment_id = payments.id.
--
-- Run in Supabase SQL editor. Uncomment APPLY blocks (PART 3–6) one at a time.
-- ============================================================================

-- ###########################################################################
-- PART 1 — DETECTION REPORT (read-only)
-- Replace NULL with a company UUID to scope; leave predicate commented for all tenants.
-- ###########################################################################

-- 1A) Core broken pattern: typed "payment" JE missing link on either side
SELECT
  '1A_payment_je_weak_link'::text AS slice,
  je.company_id,
  COUNT(*)::bigint AS row_count
FROM public.journal_entries je
WHERE COALESCE(je.is_void, false) = false
  AND LOWER(TRIM(COALESCE(je.reference_type, ''))) IN ('payment', 'payment_adjustment')
  AND (je.payment_id IS NULL OR je.reference_id IS NULL)
  -- AND je.company_id = 'YOUR-COMPANY-UUID'::uuid
GROUP BY je.company_id
ORDER BY row_count DESC;

SELECT
  je.id,
  je.company_id,
  je.branch_id,
  je.entry_no,
  je.entry_date,
  je.reference_type,
  je.reference_id,
  je.payment_id,
  je.description
FROM public.journal_entries je
WHERE COALESCE(je.is_void, false) = false
  AND LOWER(TRIM(COALESCE(je.reference_type, ''))) IN ('payment', 'payment_adjustment')
  AND (je.payment_id IS NULL OR je.reference_id IS NULL)
  -- AND je.company_id = 'YOUR-COMPANY-UUID'::uuid
ORDER BY je.entry_date DESC, je.created_at DESC
LIMIT 500;


-- 1B) Sale/purchase payment JEs: payment_id set but document reference missing
SELECT
  '1B_sale_purchase_pay_je_missing_doc_ref'::text AS slice,
  je.company_id,
  COUNT(*)::bigint AS row_count
FROM public.journal_entries je
WHERE COALESCE(je.is_void, false) = false
  AND je.payment_id IS NOT NULL
  AND je.reference_id IS NULL
  AND LOWER(TRIM(COALESCE(je.reference_type, ''))) IN ('sale', 'purchase')
  -- AND je.company_id = 'YOUR-COMPANY-UUID'::uuid
GROUP BY je.company_id
ORDER BY row_count DESC;


-- 1C) Payments with no active JE claiming payment_id (PAYMENT_WITHOUT_JE family)
SELECT
  '1C_payment_row_no_active_je'::text AS slice,
  p.company_id,
  COUNT(*)::bigint AS row_count
FROM public.payments p
WHERE NOT EXISTS (
  SELECT 1
  FROM public.journal_entries j
  WHERE j.payment_id = p.id
    AND COALESCE(j.is_void, false) = false
)
  -- AND p.company_id = 'YOUR-COMPANY-UUID'::uuid
GROUP BY p.company_id
ORDER BY row_count DESC
LIMIT 50;


-- 1D) Walk-in / default customer — payments missing an active JE (on-account priority)
SELECT
  '1D_walkin_payments_missing_je'::text AS slice,
  c.id AS contact_id,
  c.name AS contact_name,
  p.id AS payment_id,
  p.company_id,
  p.reference_number,
  p.reference_type AS payment_ref_type,
  p.amount,
  p.payment_date
FROM public.contacts c
JOIN public.payments p ON p.contact_id = c.id AND p.company_id = c.company_id
WHERE (c.is_default = true OR LOWER(COALESCE(c.system_type, '')) = 'walking_customer'
  OR LOWER(COALESCE(c.name, '')) LIKE '%walk-in%')
  -- AND c.company_id = 'YOUR-COMPANY-UUID'::uuid
  AND COALESCE(p.amount, 0) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.journal_entries j
    WHERE j.payment_id = p.id
      AND COALESCE(j.is_void, false) = false
  )
ORDER BY p.payment_date DESC NULLS LAST
LIMIT 200;

-- 1E) Companies with a default walking customer — weak payment JEs (likely on-account path)
SELECT
  je.id,
  je.company_id,
  je.entry_date,
  je.entry_no,
  je.reference_type,
  je.reference_id,
  je.payment_id,
  je.description
FROM public.journal_entries je
WHERE COALESCE(je.is_void, false) = false
  AND LOWER(TRIM(COALESCE(je.reference_type, ''))) IN ('payment', 'payment_adjustment')
  AND (je.payment_id IS NULL OR je.reference_id IS NULL)
  AND EXISTS (
    SELECT 1
    FROM public.contacts c
    WHERE c.company_id = je.company_id
      AND (c.is_default = true OR LOWER(COALESCE(c.system_type, '')) = 'walking_customer')
  )
  -- AND je.company_id = 'YOUR-COMPANY-UUID'::uuid
ORDER BY je.entry_date DESC
LIMIT 200;


-- ###########################################################################
-- PART 2 — DRY-RUN: deterministic symmetry (what APPLY-PART 3–5 would touch)
-- ###########################################################################

SELECT
  'PREVIEW_P3_ref_from_payment_id'::text AS action,
  je.id,
  je.company_id,
  je.payment_id AS will_set_reference_id_to
FROM public.journal_entries je
WHERE COALESCE(je.is_void, false) = false
  AND LOWER(TRIM(COALESCE(je.reference_type, ''))) IN ('payment', 'payment_adjustment')
  AND je.payment_id IS NOT NULL
  AND je.reference_id IS NULL
  AND EXISTS (SELECT 1 FROM public.payments p WHERE p.id = je.payment_id)
  -- AND je.company_id = 'YOUR-COMPANY-UUID'::uuid
;

SELECT
  'PREVIEW_P4_payment_id_from_ref'::text AS action,
  je.id,
  je.company_id,
  je.reference_id AS will_set_payment_id_to
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
  )
  -- AND je.company_id = 'YOUR-COMPANY-UUID'::uuid
;

SELECT
  'PREVIEW_P5_doc_ref_from_payment_row'::text AS action,
  je.id,
  je.company_id,
  je.reference_type,
  je.payment_id,
  p.reference_id AS will_set_reference_id_to,
  p.reference_type AS payment_reference_type
FROM public.journal_entries je
JOIN public.payments p ON p.id = je.payment_id
WHERE COALESCE(je.is_void, false) = false
  AND je.reference_id IS NULL
  AND je.payment_id IS NOT NULL
  AND LOWER(TRIM(COALESCE(je.reference_type, ''))) IN ('sale', 'purchase')
  AND p.reference_id IS NOT NULL
  -- AND je.company_id = 'YOUR-COMPANY-UUID'::uuid
;


-- ###########################################################################
-- PART 2B — HEURISTIC UNIQUE MATCH (dry-run)
-- ###########################################################################
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
    p.reference_number,
    p.amount,
    p.payment_date,
    p.contact_id,
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
SELECT
  'PREVIEW_P6_heuristic_unique'::text AS action,
  je_id,
  payment_id,
  reference_number,
  amount,
  payment_date,
  match_count_for_je,
  match_count_for_payment
FROM candidates
WHERE match_count_for_je = 1
  AND match_count_for_payment = 1
ORDER BY payment_date DESC
LIMIT 500;


-- ###########################################################################
-- PART 2C — Grouped repair buckets (summary row counts; run after PART 2 / 2B)
-- ###########################################################################
SELECT * FROM (
  SELECT 1 AS sort_key, 'BUCKET_P3_ref_from_payment_id'::text AS bucket,
    COUNT(*)::bigint AS rows_to_repair
  FROM public.journal_entries je
  WHERE COALESCE(je.is_void, false) = false
    AND LOWER(TRIM(COALESCE(je.reference_type, ''))) IN ('payment', 'payment_adjustment')
    AND je.payment_id IS NOT NULL AND je.reference_id IS NULL
    AND EXISTS (SELECT 1 FROM public.payments p WHERE p.id = je.payment_id)
  UNION ALL
  SELECT 2, 'BUCKET_P4_payment_id_from_reference_id',
    COUNT(*)::bigint
  FROM public.journal_entries je
  WHERE COALESCE(je.is_void, false) = false
    AND LOWER(TRIM(COALESCE(je.reference_type, ''))) IN ('payment', 'payment_adjustment')
    AND je.reference_id IS NOT NULL AND je.payment_id IS NULL
    AND EXISTS (SELECT 1 FROM public.payments p WHERE p.id = je.reference_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.journal_entries j2
      WHERE j2.payment_id = je.reference_id AND j2.id <> je.id AND COALESCE(j2.is_void, false) = false
    )
  UNION ALL
  SELECT 3, 'BUCKET_P5_sale_purchase_doc_ref',
    COUNT(*)::bigint
  FROM public.journal_entries je
  JOIN public.payments p ON p.id = je.payment_id
  WHERE COALESCE(je.is_void, false) = false
    AND je.reference_id IS NULL AND je.payment_id IS NOT NULL
    AND LOWER(TRIM(COALESCE(je.reference_type, ''))) IN ('sale', 'purchase')
    AND p.reference_id IS NOT NULL
  UNION ALL
  SELECT 4, 'BUCKET_P6_heuristic_unique_je',
    COUNT(*)::bigint
  FROM (
    WITH je_amount AS (
      SELECT je.id AS je_id, je.company_id, je.branch_id, je.entry_date,
        COALESCE(SUM(jel.debit), 0) AS total_debit
      FROM public.journal_entries je
      JOIN public.journal_entry_lines jel ON jel.journal_entry_id = je.id
      WHERE COALESCE(je.is_void, false) = false
        AND LOWER(TRIM(COALESCE(je.reference_type, ''))) = 'payment'
        AND je.payment_id IS NULL AND je.reference_id IS NULL
      GROUP BY je.id, je.company_id, je.branch_id, je.entry_date
      HAVING ABS(COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0)) < 0.02 AND COUNT(*) = 2
    ),
    candidates AS (
      SELECT j.je_id, p.id AS payment_id,
        COUNT(*) OVER (PARTITION BY j.je_id) AS cj,
        COUNT(*) OVER (PARTITION BY p.id) AS cp
      FROM je_amount j
      JOIN public.payments p ON p.company_id = j.company_id
        AND ABS(COALESCE(p.amount, 0) - j.total_debit) < 0.02
        AND p.payment_date IS NOT NULL AND j.entry_date IS NOT NULL
        AND p.payment_date BETWEEN (j.entry_date - 2) AND (j.entry_date + 2)
        AND (j.branch_id IS NULL OR p.branch_id IS NULL OR p.branch_id = j.branch_id)
      WHERE NOT EXISTS (
        SELECT 1 FROM public.journal_entries x
        WHERE x.payment_id = p.id AND COALESCE(x.is_void, false) = false
      )
    )
    SELECT je_id FROM candidates WHERE cj = 1 AND cp = 1
  ) u
) s
ORDER BY sort_key;


-- ###########################################################################
-- PART 3 — APPLY: reference_id = payment_id (uncomment + set v_batch)
-- ###########################################################################
/*
BEGIN;

DO $$
DECLARE
  v_batch UUID := '11111111-1111-1111-1111-111111111101'::uuid;
BEGIN
  INSERT INTO public.je_payment_linkage_repair_audit (
    repair_batch_id, company_id, journal_entry_id, bucket,
    old_payment_id, old_reference_id, new_payment_id, new_reference_id, note
  )
  SELECT
    v_batch,
    je.company_id,
    je.id,
    'P3_ref_from_payment_id',
    je.payment_id::text,
    je.reference_id::text,
    je.payment_id::text,
    je.payment_id::text,
    'Set reference_id = payment_id for payment-type JE'
  FROM public.journal_entries je
  WHERE COALESCE(je.is_void, false) = false
    AND LOWER(TRIM(COALESCE(je.reference_type, ''))) IN ('payment', 'payment_adjustment')
    AND je.payment_id IS NOT NULL
    AND je.reference_id IS NULL
    AND EXISTS (SELECT 1 FROM public.payments p WHERE p.id = je.payment_id);

  UPDATE public.journal_entries je
  SET reference_id = je.payment_id
  WHERE COALESCE(je.is_void, false) = false
    AND LOWER(TRIM(COALESCE(je.reference_type, ''))) IN ('payment', 'payment_adjustment')
    AND je.payment_id IS NOT NULL
    AND je.reference_id IS NULL
    AND EXISTS (SELECT 1 FROM public.payments p WHERE p.id = je.payment_id);
END $$;

COMMIT;
*/


-- ###########################################################################
-- PART 4 — APPLY: payment_id = reference_id when reference_id is payments.id
-- ###########################################################################
/*
BEGIN;

DO $$
DECLARE
  v_batch UUID := '11111111-1111-1111-1111-111111111102'::uuid;
BEGIN
  INSERT INTO public.je_payment_linkage_repair_audit (
    repair_batch_id, company_id, journal_entry_id, bucket,
    old_payment_id, old_reference_id, new_payment_id, new_reference_id, note
  )
  SELECT
    v_batch,
    je.company_id,
    je.id,
    'P4_payment_id_from_reference_id',
    je.payment_id::text,
    je.reference_id::text,
    je.reference_id::text,
    je.reference_id::text,
    'Set payment_id = reference_id when reference_id is a payments row'
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
END $$;

COMMIT;
*/


-- ###########################################################################
-- PART 5 — APPLY: sale/purchase JE — reference_id from payments.reference_id
-- ###########################################################################
/*
BEGIN;

DO $$
DECLARE
  v_batch UUID := '11111111-1111-1111-1111-111111111103'::uuid;
BEGIN
  INSERT INTO public.je_payment_linkage_repair_audit (
    repair_batch_id, company_id, journal_entry_id, bucket,
    old_payment_id, old_reference_id, new_payment_id, new_reference_id, note
  )
  SELECT
    v_batch,
    je.company_id,
    je.id,
    'P5_doc_ref_from_payment',
    je.payment_id::text,
    je.reference_id::text,
    je.payment_id::text,
    p.reference_id::text,
    'Fill document reference_id from payments row for sale/purchase payment JE'
  FROM public.journal_entries je
  JOIN public.payments p ON p.id = je.payment_id
  WHERE COALESCE(je.is_void, false) = false
    AND je.reference_id IS NULL
    AND je.payment_id IS NOT NULL
    AND LOWER(TRIM(COALESCE(je.reference_type, ''))) IN ('sale', 'purchase')
    AND p.reference_id IS NOT NULL;

  UPDATE public.journal_entries je
  SET reference_id = p.reference_id
  FROM public.payments p
  WHERE p.id = je.payment_id
    AND COALESCE(je.is_void, false) = false
    AND je.reference_id IS NULL
    AND je.payment_id IS NOT NULL
    AND LOWER(TRIM(COALESCE(je.reference_type, ''))) IN ('sale', 'purchase')
    AND p.reference_id IS NOT NULL;
END $$;

COMMIT;
*/


-- ###########################################################################
-- PART 6 — APPLY: heuristic unique match
-- ###########################################################################
/*
BEGIN;

DO $$
DECLARE
  v_batch UUID := '11111111-1111-1111-1111-111111111104'::uuid;
BEGIN
  CREATE TEMP TABLE tmp_je_pay_unique ON COMMIT DROP AS
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
    v_batch,
    je.company_id,
    t.je_id,
    'P6_heuristic_unique',
    je.payment_id::text,
    je.reference_id::text,
    t.payment_id::text,
    t.payment_id::text,
    'Linked orphan payment-type JE to sole matching payments row'
  FROM tmp_je_pay_unique t
  JOIN public.journal_entries je ON je.id = t.je_id;

  UPDATE public.journal_entries je
  SET
    payment_id = t.payment_id,
    reference_id = t.payment_id
  FROM tmp_je_pay_unique t
  WHERE je.id = t.je_id;
END $$;

COMMIT;
*/


-- ###########################################################################
-- PART 7 — ROLLBACK (per repair_batch_id)
-- ###########################################################################
/*
UPDATE public.journal_entries je
SET
  payment_id = CASE
    WHEN a.old_payment_id IS NULL OR a.old_payment_id = '' THEN NULL
    ELSE a.old_payment_id::uuid
  END,
  reference_id = CASE
    WHEN a.old_reference_id IS NULL OR a.old_reference_id = '' THEN NULL
    ELSE a.old_reference_id::uuid
  END
FROM public.je_payment_linkage_repair_audit a
WHERE je.id = a.journal_entry_id
  AND a.repair_batch_id = '11111111-1111-1111-1111-111111111101'::uuid;
*/


-- PART 8 — Re-run PART 1A / 1B counts after repairs.
