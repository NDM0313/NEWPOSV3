-- Apply global duplicate cleanup (safe-void only, no delete).
-- Keep earliest row by created_at, id; void later duplicates.
-- Covers:
--   1) duplicate primary journal per payment_id (excluding payment_adjustment)
--   2) duplicate entry_no (case-insensitive)
--   3) duplicate action_fingerprint

BEGIN;

-- 1) duplicate primary per payment_id
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY company_id, payment_id
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM public.journal_entries
  WHERE payment_id IS NOT NULL
    AND COALESCE(is_void, false) = false
    AND reference_type IS DISTINCT FROM 'payment_adjustment'
),
dups AS (
  SELECT id FROM ranked WHERE rn > 1
)
UPDATE public.journal_entries j
SET is_void = true
FROM dups
WHERE j.id = dups.id;

-- 2) duplicate entry_no (case-insensitive)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY company_id, LOWER(TRIM(entry_no))
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM public.journal_entries
  WHERE COALESCE(is_void, false) = false
    AND entry_no IS NOT NULL
    AND TRIM(entry_no) <> ''
),
dups AS (
  SELECT id FROM ranked WHERE rn > 1
)
UPDATE public.journal_entries j
SET is_void = true
FROM dups
WHERE j.id = dups.id;

-- 3) duplicate action_fingerprint
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY company_id, action_fingerprint
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM public.journal_entries
  WHERE COALESCE(is_void, false) = false
    AND action_fingerprint IS NOT NULL
    AND TRIM(action_fingerprint) <> ''
),
dups AS (
  SELECT id FROM ranked WHERE rn > 1
)
UPDATE public.journal_entries j
SET is_void = true
FROM dups
WHERE j.id = dups.id;

COMMIT;
