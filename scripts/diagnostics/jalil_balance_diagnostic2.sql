-- RPC row count and last running balance for JALIL
WITH raw AS (
  SELECT get_customer_ar_gl_ledger_for_contact(
    '30bd8592-3384-4f34-899a-f3907e336485'::uuid,
    'fe7ec33d-fd6d-4aa6-8d21-416e383b4c93'::uuid,
    NULL::uuid,
    '2000-01-01'::date,
    '2099-12-31'::date
  ) AS j
),
rows AS (
  SELECT json_array_elements(j) AS elem FROM raw
)
SELECT
  count(*) AS rpc_row_count,
  round(coalesce(sum((elem->>'debit')::numeric), 0), 2) AS sum_debit,
  round(coalesce(sum((elem->>'credit')::numeric), 0), 2) AS sum_credit,
  (SELECT round((elem->>'running_balance')::numeric, 2)
   FROM rows
   ORDER BY (elem->>'sort_order')::int DESC NULLS LAST,
            (elem->>'date') DESC,
            (elem->>'entry_no') DESC
   LIMIT 1) AS last_running_balance
FROM rows;

-- Party-resolved AR subtree lines (all branches)
SELECT count(*) AS party_line_count,
  round(coalesce(sum(jel.debit),0)::numeric, 2) AS dr,
  round(coalesce(sum(jel.credit),0)::numeric, 2) AS cr,
  round(coalesce(sum(jel.debit - jel.credit),0)::numeric, 2) AS net
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN accounts acc ON acc.id = jel.account_id
WHERE je.company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND COALESCE(je.is_void, false) = false
  AND acc.code LIKE 'AR-%' OR acc.linked_contact_id = 'fe7ec33d-fd6d-4aa6-8d21-416e383b4c93';

-- Sales for customer
SELECT count(*) AS finals,
  round(coalesce(sum(grand_total),0)::numeric, 2) AS grand_total_sum
FROM sales
WHERE company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND customer_id = 'fe7ec33d-fd6d-4aa6-8d21-416e383b4c93'
  AND lower(status) = 'final';

-- get_contact_party_gl_balances
SELECT *
FROM get_contact_party_gl_balances(
  '30bd8592-3384-4f34-899a-f3907e336485'::uuid,
  NULL::uuid,
  CURRENT_DATE
)
WHERE contact_id = 'fe7ec33d-fd6d-4aa6-8d21-416e383b4c93';
