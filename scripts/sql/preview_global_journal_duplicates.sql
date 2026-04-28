-- Global duplicate preview across all companies (active journals only).
-- 1) duplicate primary journal per payment_id (excluding payment_adjustment)
-- 2) duplicate entry_no (case-insensitive)
-- 3) duplicate action_fingerprint

-- A) duplicate primary per payment
SELECT
  'duplicate_primary_per_payment' AS check_type,
  company_id,
  COUNT(*)::int AS duplicate_groups,
  COALESCE(SUM(je_count - 1), 0)::int AS duplicate_rows_to_void
FROM (
  SELECT company_id, payment_id, COUNT(*) AS je_count
  FROM public.journal_entries
  WHERE payment_id IS NOT NULL
    AND COALESCE(is_void, false) = false
    AND reference_type IS DISTINCT FROM 'payment_adjustment'
  GROUP BY company_id, payment_id
  HAVING COUNT(*) > 1
) t
GROUP BY company_id
ORDER BY duplicate_rows_to_void DESC, company_id;

-- B) duplicate entry_no
SELECT
  'duplicate_entry_no' AS check_type,
  company_id,
  COUNT(*)::int AS duplicate_groups,
  COALESCE(SUM(je_count - 1), 0)::int AS duplicate_rows_to_void
FROM (
  SELECT company_id, LOWER(TRIM(entry_no)) AS entry_no_norm, COUNT(*) AS je_count
  FROM public.journal_entries
  WHERE COALESCE(is_void, false) = false
    AND entry_no IS NOT NULL
    AND TRIM(entry_no) <> ''
  GROUP BY company_id, LOWER(TRIM(entry_no))
  HAVING COUNT(*) > 1
) t
GROUP BY company_id
ORDER BY duplicate_rows_to_void DESC, company_id;

-- C) duplicate action_fingerprint
SELECT
  'duplicate_action_fingerprint' AS check_type,
  company_id,
  COUNT(*)::int AS duplicate_groups,
  COALESCE(SUM(je_count - 1), 0)::int AS duplicate_rows_to_void
FROM (
  SELECT company_id, action_fingerprint, COUNT(*) AS je_count
  FROM public.journal_entries
  WHERE COALESCE(is_void, false) = false
    AND action_fingerprint IS NOT NULL
    AND TRIM(action_fingerprint) <> ''
  GROUP BY company_id, action_fingerprint
  HAVING COUNT(*) > 1
) t
GROUP BY company_id
ORDER BY duplicate_rows_to_void DESC, company_id;
