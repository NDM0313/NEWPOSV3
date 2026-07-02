SELECT left(get_customer_ar_gl_ledger_for_contact(
  '30bd8592-3384-4f34-899a-f3907e336485'::uuid,
  'fe7ec33d-fd6d-4aa6-8d21-416e383b4c93'::uuid,
  NULL::uuid,
  '2000-01-01'::date,
  '2099-12-31'::date
)::text, 500) AS rpc_prefix;

SELECT json_typeof(get_customer_ar_gl_ledger_for_contact(
  '30bd8592-3384-4f34-899a-f3907e336485'::uuid,
  'fe7ec33d-fd6d-4aa6-8d21-416e383b4c93'::uuid,
  NULL::uuid,
  '2000-01-01'::date,
  '2099-12-31'::date
)) AS rpc_json_type;

-- If object with entries key
WITH j AS (
  SELECT get_customer_ar_gl_ledger_for_contact(
    '30bd8592-3384-4f34-899a-f3907e336485'::uuid,
    'fe7ec33d-fd6d-4aa6-8d21-416e383b4c93'::uuid,
    NULL::uuid,
    '2000-01-01'::date,
    '2099-12-31'::date
  ) AS doc
)
SELECT
  (doc->>'closing_balance')::numeric AS closing_balance,
  (doc->>'opening_balance')::numeric AS opening_balance,
  json_array_length(COALESCE(doc->'entries', '[]'::json)) AS entry_count
FROM j;

-- Sales columns
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='sales'
  AND column_name ~* 'total|amount|grand'
ORDER BY 1;
