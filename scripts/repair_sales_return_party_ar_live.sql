-- LIVE REPAIR (audited): run only after migration 20260444_gl_resolve_party_return_documents.sql
-- and after backing up affected journal_entries / journal_entry_lines.
--
-- Problem A: reference_type stored as "sale return" (space) — fixed globally by migration UPDATE.
-- Problem B: AR credit line posted to control 1100 id instead of customer party child — party GL / statement
--            used linked_contact on account; control has NULL → line excluded from customer slice.
--
-- This script remaps AR **credit** lines on sale_return JEs from the AR control account id to the
-- company's receivable sub-account for that return's customer_id (linked_contact_id = customer).
--
-- SET company_id and optionally limit to one sale_return id for a surgical repair.

BEGIN;

-- Optional: single return
-- AND je.reference_id = 'YOUR-SALE-RETURN-UUID'

WITH ar_control AS (
  SELECT a.id, a.company_id
  FROM public.accounts a
  WHERE a.company_id = 'YOUR-COMPANY-UUID'::uuid  -- <<< set
    AND trim(coalesce(a.code, '')) = '1100'
    AND coalesce(a.is_active, true)
  LIMIT 1
),
targets AS (
  SELECT
    jel.id AS line_id,
    jel.account_id AS old_account_id,
    sr.customer_id,
    je.id AS je_id,
    je.entry_no
  FROM public.journal_entry_lines jel
  INNER JOIN public.journal_entries je ON je.id = jel.journal_entry_id
  INNER JOIN public.sale_returns sr ON sr.id = je.reference_id::uuid AND sr.company_id = je.company_id
  CROSS JOIN ar_control ac
  WHERE je.company_id = ac.company_id
    AND coalesce(je.is_void, false) = false
    AND lower(regexp_replace(trim(coalesce(je.reference_type, '')), '\s+', '_', 'g')) = 'sale_return'
    AND jel.credit > 0
    AND jel.account_id = ac.id
    AND sr.customer_id IS NOT NULL
),
party_ar AS (
  SELECT DISTINCT ON (t.customer_id)
    t.customer_id,
    a.id AS party_ar_account_id
  FROM targets t
  INNER JOIN public.accounts a
    ON a.company_id = (SELECT company_id FROM ar_control)
    AND a.linked_contact_id = t.customer_id
    AND coalesce(a.is_active, true)
  ORDER BY t.customer_id, length(coalesce(a.code, '')), a.code
)
UPDATE public.journal_entry_lines jel
SET account_id = pa.party_ar_account_id
FROM targets t
INNER JOIN party_ar pa ON pa.customer_id = t.customer_id
WHERE jel.id = t.line_id
  AND pa.party_ar_account_id IS NOT NULL
  AND pa.party_ar_account_id IS DISTINCT FROM t.old_account_id;

-- Log what was touched (run SELECT separately before UPDATE to preview):
-- SELECT * FROM targets t
-- LEFT JOIN party_ar pa ON pa.customer_id = t.customer_id;

COMMIT;
