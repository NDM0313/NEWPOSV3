-- ============================================================================
-- Payment reference allocation — read-only diagnostics
-- Replace both occurrences of PASTE_COMPANY_UUID with your company UUID, then
-- run each block in the Supabase SQL editor (or run the whole file in psql).
-- ============================================================================

WITH params AS (
  SELECT 'PASTE_COMPANY_UUID'::uuid AS company_id
)

-- 1) Duplicate reference_number (should return no rows in steady state)
SELECT
  p.reference_number,
  COUNT(*) AS use_count,
  array_agg(p.id ORDER BY p.created_at) AS payment_ids
FROM payments p
CROSS JOIN params x
WHERE p.company_id = x.company_id
  AND p.reference_number IS NOT NULL
  AND p.reference_number <> ''
GROUP BY p.reference_number
HAVING COUNT(*) > 1
ORDER BY use_count DESC;

-- 2) Sequence drift: max numeric suffix in payments vs erp_document_sequences (PAYMENT)
WITH params AS (
  SELECT 'PASTE_COMPANY_UUID'::uuid AS company_id
),
pay_max AS (
  SELECT COALESCE(MAX(CAST(SUBSTRING(p.reference_number FROM '([0-9]+)$') AS BIGINT)), 0) AS observed
  FROM payments p
  CROSS JOIN params x
  WHERE p.company_id = x.company_id
    AND p.reference_number ~ '([0-9]+)$'
    AND p.reference_number NOT ILIKE 'PAY-BACKFILL-%'
    AND LENGTH(SUBSTRING(p.reference_number FROM '([0-9]+)$')) <= 9
)
SELECT
  (SELECT observed FROM pay_max) AS max_numeric_suffix_in_payments,
  eds.branch_id,
  eds.document_type,
  eds.last_number,
  eds.prefix,
  eds.year
FROM public.erp_document_sequences eds
CROSS JOIN params x
WHERE eds.company_id = x.company_id
  AND eds.document_type = 'PAYMENT';
