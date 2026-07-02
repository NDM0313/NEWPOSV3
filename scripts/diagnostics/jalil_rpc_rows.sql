WITH payload AS (
  SELECT get_customer_ar_gl_ledger_for_contact(
    '30bd8592-3384-4f34-899a-f3907e336485'::uuid,
    'fe7ec33d-fd6d-4aa6-8d21-416e383b4c93'::uuid,
    NULL::uuid,
    '2000-01-01'::date,
    '2099-12-31'::date
  ) AS doc
),
rows AS (
  SELECT json_array_elements(doc->'rows') AS r FROM payload
)
SELECT
  count(*) AS row_count,
  round(sum((r->>'debit')::numeric), 2) AS sum_debit,
  round(sum((r->>'credit')::numeric), 2) AS sum_credit,
  round((array_agg((r->>'running_balance')::numeric ORDER BY (r->>'entry_date'), (r->>'entry_no')) FILTER (WHERE true))[array_length(array_agg((r->>'running_balance')::numeric), 1)], 2) AS last_rb
FROM rows;

SELECT (doc->>'period_opening_balance')::numeric AS period_opening,
       json_array_length(doc->'rows') AS rows
FROM (
  SELECT get_customer_ar_gl_ledger_for_contact(
    '30bd8592-3384-4f34-899a-f3907e336485'::uuid,
    'fe7ec33d-fd6d-4aa6-8d21-416e383b4c93'::uuid,
    NULL::uuid,
    '2000-01-01'::date,
    '2099-12-31'::date
  ) AS doc
) x;

-- List all RPC rows summary
WITH payload AS (
  SELECT get_customer_ar_gl_ledger_for_contact(
    '30bd8592-3384-4f34-899a-f3907e336485'::uuid,
    'fe7ec33d-fd6d-4aa6-8d21-416e383b4c93'::uuid,
    NULL::uuid,
    '2000-01-01'::date,
    '2099-12-31'::date
  ) AS doc
),
rows AS (
  SELECT json_array_elements(doc->'rows') AS r FROM payload
)
SELECT
  r->>'entry_no' AS entry_no,
  r->>'entry_date' AS dt,
  r->>'reference_type' AS ref_type,
  round((r->>'debit')::numeric, 2) AS debit,
  round((r->>'credit')::numeric, 2) AS credit,
  round((r->>'running_balance')::numeric, 2) AS running_balance,
  left(r->>'description', 60) AS descr
FROM rows
ORDER BY (r->>'entry_date'), (r->>'entry_no');

-- Sales total for customer
SELECT count(*), round(sum(total + coalesce(shipment_charges,0)), 2) AS sale_total
FROM sales
WHERE company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND customer_id = 'fe7ec33d-fd6d-4aa6-8d21-416e383b4c93'
  AND lower(status) = 'final';
