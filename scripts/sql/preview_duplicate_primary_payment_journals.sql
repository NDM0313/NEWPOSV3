-- Preview: payments with more than one active primary-linked journal entry.
-- Replace the company UUID literal before running.

WITH primary_je AS (
  SELECT
    je.id,
    je.payment_id,
    je.entry_no,
    je.reference_type,
    je.created_at,
    p.reference_type AS pay_ref_type,
    p.amount::numeric AS pay_amount
  FROM public.journal_entries je
  INNER JOIN public.payments p ON p.id = je.payment_id AND p.company_id = je.company_id
  WHERE je.company_id = '00000000-0000-0000-0000-000000000000'::uuid
    AND COALESCE(je.is_void, FALSE) = FALSE
    AND (je.reference_type IS DISTINCT FROM 'payment_adjustment')
)
SELECT
  payment_id,
  COUNT(*)::int AS primary_je_count,
  (ARRAY_AGG(id ORDER BY created_at ASC NULLS LAST, id ASC))[1] AS keep_journal_id,
  MAX(pay_ref_type) AS payment_reference_type,
  MAX(pay_amount) AS payment_amount
FROM primary_je
GROUP BY payment_id
HAVING COUNT(*) > 1
ORDER BY payment_id;
