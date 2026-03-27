-- APPLY: void duplicate primary payment journals (keep earliest created_at per payment_id).
-- Run preview script first. Replace company UUID. PF-14 payment_adjustment rows are untouched.

BEGIN;

WITH ranked AS (
  SELECT
    je.id,
    ROW_NUMBER() OVER (
      PARTITION BY je.payment_id
      ORDER BY je.created_at ASC NULLS LAST, je.id ASC
    ) AS rn
  FROM public.journal_entries je
  WHERE je.company_id = '00000000-0000-0000-0000-000000000000'::uuid
    AND je.payment_id IS NOT NULL
    AND COALESCE(je.is_void, FALSE) = FALSE
    AND (je.reference_type IS DISTINCT FROM 'payment_adjustment')
),
dups AS (
  SELECT id FROM ranked WHERE rn > 1
)
UPDATE public.journal_entries j
SET is_void = true
FROM dups
WHERE j.id = dups.id;

COMMIT;
