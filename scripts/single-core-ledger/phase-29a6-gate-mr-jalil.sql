-- Phase 2.9A-6 — read-only MR JALIL unified closing (effective_party, lifetime scope)
WITH rpc AS (
  SELECT public.get_unified_party_ledger(
    '30bd8592-3384-4f34-899a-f3907e336485'::uuid,
    'customer'::text,
    'fe7ec33d-fd6d-4aa6-8d21-416e383b4c93'::uuid,
    NULL::uuid,
    NULL::date,
    NULL::date,
    'effective_party'::text
  )::jsonb AS data
),
rows AS (
  SELECT jsonb_array_elements(COALESCE(data->'rows', '[]'::jsonb)) AS row
  FROM rpc
)
SELECT
  COALESCE(
    (SELECT (row->>'running_balance')::numeric
     FROM rows
     ORDER BY (row->>'entry_date') DESC NULLS LAST, (row->>'entry_no') DESC NULLS LAST
     LIMIT 1),
    (SELECT (data->>'period_opening_balance')::numeric FROM rpc)
  ) AS closing_balance,
  (SELECT jsonb_array_length(COALESCE(data->'rows', '[]'::jsonb)) FROM rpc) AS row_count;
