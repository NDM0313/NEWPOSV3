-- Preview duplicate JE pairs for the same payment where both SALE and PAYMENT references exist.
-- Canonical keep rule: keep PAYMENT reference JE, void SALE reference JE.

WITH active_je AS (
  SELECT
    je.id,
    je.company_id,
    je.entry_no,
    je.reference_type,
    je.reference_id,
    je.payment_id,
    je.created_at
  FROM public.journal_entries je
  WHERE COALESCE(je.is_void, FALSE) = FALSE
),
pairs AS (
  SELECT
    s.company_id,
    s.payment_id,
    s.id AS sale_je_id,
    s.entry_no AS sale_entry_no,
    s.created_at AS sale_created_at,
    p.id AS payment_je_id,
    p.entry_no AS payment_entry_no,
    p.created_at AS payment_created_at
  FROM active_je s
  JOIN active_je p
    ON p.reference_type = 'payment'
   AND (
     p.payment_id = s.payment_id
     OR p.reference_id = s.payment_id
   )
  WHERE s.reference_type = 'sale'
    AND s.payment_id IS NOT NULL
)
SELECT
  company_id,
  payment_id,
  sale_je_id,
  sale_entry_no,
  sale_created_at,
  payment_je_id,
  payment_entry_no,
  payment_created_at
FROM pairs
ORDER BY payment_created_at DESC, payment_id;
