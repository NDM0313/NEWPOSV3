-- Deep line-level analysis: JE-0074, JE-0075, JE-0078 (edited payment / PF-14 chain case)
-- Replace :company_id below in all CTEs if you copy sections separately.

WITH params AS (
  SELECT '595c08c2-1e47-4581-89c9-1f78de51c613'::uuid AS company_id
)
-- 1) Headers for the three entry numbers
SELECT
  je.id,
  je.entry_no,
  je.entry_date,
  je.reference_type,
  je.reference_id,
  je.payment_id,
  je.description,
  je.action_fingerprint,
  je.economic_event_id,
  je.is_void,
  je.void_reason,
  je.created_at
FROM journal_entries je
CROSS JOIN params p
WHERE je.company_id = p.company_id
  AND je.entry_no IN ('JE-0074', 'JE-0075', 'JE-0078')
ORDER BY je.created_at;

-- 2) Lines with account codes
WITH params AS (
  SELECT '595c08c2-1e47-4581-89c9-1f78de51c613'::uuid AS company_id
)
SELECT
  je.entry_no,
  je.id AS journal_entry_id,
  a.code,
  a.name,
  jl.debit,
  jl.credit,
  jl.description AS line_description
FROM journal_entries je
CROSS JOIN params p
JOIN journal_entry_lines jl ON jl.journal_entry_id = je.id
LEFT JOIN accounts a ON a.id = jl.account_id
WHERE je.company_id = p.company_id
  AND je.entry_no IN ('JE-0074', 'JE-0075', 'JE-0078')
ORDER BY je.entry_no, jl.id;

-- 3) After you read (1), pick the shared payment_id and run this block with it substituted:
--    (uncomment and set :payment_id)

/*
WITH params AS (
  SELECT
    '595c08c2-1e47-4581-89c9-1f78de51c613'::uuid AS company_id,
    'PASTE-PAYMENT-UUID-HERE'::uuid AS payment_id
)
SELECT
  je.entry_no,
  je.reference_type,
  je.payment_id,
  je.description,
  je.is_void,
  je.created_at
FROM journal_entries je
CROSS JOIN params p
WHERE je.company_id = p.company_id
  AND (
    je.payment_id = p.payment_id
    OR (je.reference_type = 'payment_adjustment' AND je.reference_id = p.payment_id)
  )
ORDER BY je.created_at;
*/
