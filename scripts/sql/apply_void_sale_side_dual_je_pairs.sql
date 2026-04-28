-- Void SALE-side duplicate JE when both SALE and PAYMENT JEs exist for the same payment_id.
-- Canonical keep rule: keep PAYMENT reference JE active.

WITH active_je AS (
  SELECT
    je.id,
    je.company_id,
    je.reference_type,
    je.reference_id,
    je.payment_id,
    je.created_at
  FROM public.journal_entries je
  WHERE COALESCE(je.is_void, FALSE) = FALSE
),
targets AS (
  SELECT DISTINCT ON (s.id)
    s.id AS sale_je_id
  FROM active_je s
  JOIN active_je p
    ON p.reference_type = 'payment'
   AND (
     p.payment_id = s.payment_id
     OR p.reference_id = s.payment_id
   )
  WHERE s.reference_type = 'sale'
    AND s.payment_id IS NOT NULL
  ORDER BY s.id
)
UPDATE public.journal_entries je
SET
  is_void = TRUE,
  void_reason = COALESCE(je.void_reason, 'Auto-cleanup: duplicate SALE JE for same payment_id; canonical PAYMENT JE retained'),
  voided_at = NOW()
WHERE je.id IN (SELECT sale_je_id FROM targets)
RETURNING je.id, je.entry_no, je.payment_id, je.reference_type, je.created_at;
