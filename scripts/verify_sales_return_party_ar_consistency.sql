-- Read-only: verify one finalized sale return (set :sale_return_id) — control AR vs party AR subtree,
-- revenue debit, and optional link to sale_returns row.
-- Usage: replace the UUID in the CTE, then run in SQL editor.

WITH p AS (
  SELECT 'ee0b3e4d-7df4-490b-98d7-646d5ae74c06'::uuid AS sale_return_id  -- <<< set this
),
sr AS (
  SELECT sr.* FROM public.sale_returns sr, p WHERE sr.id = p.sale_return_id
),
ar_control AS (
  SELECT a.id FROM public.accounts a, sr
  WHERE a.company_id = sr.company_id AND trim(coalesce(a.code, '')) = '1100' AND coalesce(a.is_active, true) LIMIT 1
),
ar_subtree AS (
  WITH RECURSIVE sub AS (
    SELECT c.id FROM ar_control c WHERE c.id IS NOT NULL
    UNION ALL
    SELECT a.id FROM public.accounts a
    INNER JOIN sub s ON a.parent_id = s.id
    WHERE a.company_id = (SELECT company_id FROM sr) AND coalesce(a.is_active, true)
  )
  SELECT id FROM sub
),
jes AS (
  SELECT je.id, je.entry_no, je.entry_date, je.reference_type, je.reference_id, je.description
  FROM public.journal_entries je, sr
  WHERE je.company_id = sr.company_id
    AND coalesce(je.is_void, false) = false
    AND lower(regexp_replace(trim(coalesce(je.reference_type, '')), '\s+', '_', 'g')) = 'sale_return'
    AND je.reference_id = (SELECT id FROM sr)
),
lines AS (
  SELECT
    jel.id AS line_id,
    jel.debit,
    jel.credit,
    trim(coalesce(acc.code, '')) AS acode,
    coalesce(acc.name, '') AS aname,
    acc.linked_contact_id,
    jel.account_id IN (SELECT id FROM ar_subtree) AS on_ar_subtree,
    jel.account_id = (SELECT id FROM ar_control LIMIT 1) AS on_ar_control_only
  FROM public.journal_entry_lines jel
  INNER JOIN jes j ON j.id = jel.journal_entry_id
  INNER JOIN public.accounts acc ON acc.id = jel.account_id
)
SELECT
  'sale_return_header' AS section,
  (SELECT row_to_json(sr.*) FROM sr) AS data
UNION ALL
SELECT 'journal_entries', (SELECT coalesce(json_agg(jes.*), '[]'::json) FROM jes)
UNION ALL
SELECT 'lines_summary', json_build_object(
  'ar_subtree_credit', (SELECT coalesce(sum(credit), 0) FROM lines WHERE on_ar_subtree AND credit > 0),
  'ar_subtree_debit', (SELECT coalesce(sum(debit), 0) FROM lines WHERE on_ar_subtree AND debit > 0),
  'revenue_debit', (SELECT coalesce(sum(debit), 0) FROM lines WHERE acode IN ('4000', '4010') OR lower(aname) LIKE '%revenue%'),
  'credit_lines_party_linked', (SELECT count(*) FROM lines WHERE credit > 0 AND linked_contact_id IS NOT NULL),
  'credit_lines_control_only', (SELECT count(*) FROM lines WHERE credit > 0 AND on_ar_control_only)
);
