-- ============================================================================
-- Payment numbering repair playbook (manual)
-- ============================================================================
-- Purpose:
-- - Detect stale PAYMENT sequence counters versus existing payments refs.
-- - Optionally bump sequence rows so future refs do not reuse old numbers.
--
-- Notes:
-- - Run after DB backup.
-- - Review preview output before running APPLY block.
-- - Assumes refs end with numeric sequence (e.g. PAY-0042, RCV-2026-0042).
-- - Ignores historical BACKFILL refs that contain UUID-tail digits (can be huge
--   and should not drive live PAYMENT counters).
-- ============================================================================

-- --------------------------------------------------------------------------
-- PREVIEW: current sequence and observed max suffix in payments
-- --------------------------------------------------------------------------
WITH pay_max AS (
  SELECT
    p.company_id,
    MAX(
      CASE
        WHEN p.reference_number ~ '([0-9]+)$'
             AND p.reference_number NOT ILIKE 'PAY-BACKFILL-%'
             AND LENGTH(SUBSTRING(p.reference_number FROM '([0-9]+)$')) <= 9
          THEN CAST(SUBSTRING(p.reference_number FROM '([0-9]+)$') AS BIGINT)
        ELSE NULL
      END
    ) AS max_suffix
  FROM public.payments p
  WHERE COALESCE(TRIM(p.reference_number), '') <> ''
  GROUP BY p.company_id
)
SELECT
  s.company_id,
  s.branch_id,
  s.document_type,
  s.year,
  s.prefix,
  s.last_number AS sequence_last_number,
  COALESCE(pm.max_suffix, 0) AS observed_max_suffix,
  CASE
    WHEN COALESCE(pm.max_suffix, 0) > COALESCE(s.last_number, 0)::BIGINT THEN 'STALE'
    ELSE 'OK'
  END AS status
FROM public.erp_document_sequences s
LEFT JOIN pay_max pm ON pm.company_id = s.company_id
WHERE UPPER(s.document_type) = 'PAYMENT'
ORDER BY status DESC, s.company_id, s.year DESC;

-- --------------------------------------------------------------------------
-- APPLY (MANUAL): bump last_number if stale
-- --------------------------------------------------------------------------
-- Uncomment and run ONLY after preview confirmation.
/*
WITH pay_max AS (
  SELECT
    p.company_id,
    MAX(
      CASE
        WHEN p.reference_number ~ '([0-9]+)$'
             AND p.reference_number NOT ILIKE 'PAY-BACKFILL-%'
             AND LENGTH(SUBSTRING(p.reference_number FROM '([0-9]+)$')) <= 9
          THEN CAST(SUBSTRING(p.reference_number FROM '([0-9]+)$') AS BIGINT)
        ELSE NULL
      END
    ) AS max_suffix
  FROM public.payments p
  WHERE COALESCE(TRIM(p.reference_number), '') <> ''
  GROUP BY p.company_id
)
UPDATE public.erp_document_sequences s
SET
  last_number = pm.max_suffix,
  updated_at = NOW()
FROM pay_max pm
WHERE UPPER(s.document_type) = 'PAYMENT'
  AND s.company_id = pm.company_id
  AND pm.max_suffix IS NOT NULL
  AND pm.max_suffix > COALESCE(s.last_number, 0)::BIGINT;
*/
