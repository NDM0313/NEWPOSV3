-- Verify payment numbering hardening is effectively active in DB.
-- Usage:
--   - Supabase SQL editor, or
--   - psql -f scripts/system-audit/verify_payment_numbering_hardening.sql

-- 1) Migration history table presence check.
SELECT
  (to_regclass('public.migration_history') IS NOT NULL) AS has_migration_history_table;

-- If has_migration_history_table = true, run this manually:
-- SELECT id, migration_name, applied_at
-- FROM public.migration_history
-- WHERE migration_name IN (
--   '20260450_record_customer_payment_reference_retry.sql',
--   '20260455_self_healing_numbering_and_payment_retry.sql'
-- )
-- ORDER BY applied_at DESC;

-- 2) Active function definition probes.
-- We check function source text for required hardening markers.
WITH fn AS (
  SELECT
    p.proname,
    pg_get_function_identity_arguments(p.oid) AS args,
    pg_get_functiondef(p.oid) AS fn_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'generate_document_number',
      'record_payment_with_accounting',
      'record_customer_payment'
    )
)
SELECT
  proname,
  args,
  CASE
    WHEN proname = 'generate_document_number'
      THEN (fn_def ILIKE '%GREATEST(last_number + 1, v_observed::INTEGER + 1)%')
    WHEN proname = 'record_payment_with_accounting'
      THEN (fn_def ILIKE '%WHEN unique_violation THEN%' AND fn_def ILIKE '%v_max_retries%')
    WHEN proname = 'record_customer_payment'
      THEN (fn_def ILIKE '%WHEN unique_violation THEN%' AND fn_def ILIKE '%v_max_retries%')
    ELSE FALSE
  END AS hardening_marker_present,
  CASE
    WHEN proname = 'generate_document_number'
      THEN 'needs self-healing bump via observed max'
    WHEN proname IN ('record_payment_with_accounting', 'record_customer_payment')
      THEN 'needs unique_violation retry loop'
    ELSE 'n/a'
  END AS expected_marker
FROM fn
ORDER BY proname, args;

-- 3) Optional quick sequence drift signal for PAYMENT/RENTAL by company.
WITH seq AS (
  SELECT company_id, UPPER(document_type) AS document_type, year, COALESCE(last_number, 0) AS last_number
  FROM public.erp_document_sequences
  WHERE UPPER(document_type) IN ('PAYMENT', 'RENTAL')
    AND year = EXTRACT(YEAR FROM now())::int
),
pay_obs AS (
  SELECT company_id,
         COALESCE(MAX(CAST(SUBSTRING(reference_number FROM '([0-9]+)$') AS BIGINT)), 0) AS observed
  FROM public.payments
  WHERE reference_number ~ '([0-9]+)$'
    AND reference_number NOT ILIKE 'PAY-BACKFILL-%'
    AND LENGTH(SUBSTRING(reference_number FROM '([0-9]+)$')) <= 9
  GROUP BY company_id
),
rent_obs AS (
  SELECT company_id,
         COALESCE(MAX(CAST(SUBSTRING(booking_no FROM '([0-9]+)$') AS BIGINT)), 0) AS observed
  FROM public.rentals
  WHERE booking_no ~ '([0-9]+)$'
    AND LENGTH(SUBSTRING(booking_no FROM '([0-9]+)$')) <= 9
  GROUP BY company_id
)
SELECT
  s.company_id,
  s.document_type,
  s.last_number,
  CASE
    WHEN s.document_type = 'PAYMENT' THEN COALESCE(p.observed, 0)
    WHEN s.document_type = 'RENTAL' THEN COALESCE(r.observed, 0)
    ELSE 0
  END AS observed_max,
  (s.last_number >= CASE
    WHEN s.document_type = 'PAYMENT' THEN COALESCE(p.observed, 0)
    WHEN s.document_type = 'RENTAL' THEN COALESCE(r.observed, 0)
    ELSE 0
  END) AS sequence_aligned
FROM seq s
LEFT JOIN pay_obs p ON p.company_id = s.company_id
LEFT JOIN rent_obs r ON r.company_id = s.company_id
ORDER BY s.company_id, s.document_type;
