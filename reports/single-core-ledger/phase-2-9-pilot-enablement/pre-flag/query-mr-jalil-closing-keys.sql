SELECT jsonb_object_keys(
  public.get_unified_party_ledger(
    '30bd8592-3384-4f34-899a-f3907e336485'::uuid,
    'customer'::text,
    'fe7ec33d-fd6d-4aa6-8d21-416e383b4c93'::uuid,
    NULL::uuid,
    NULL::date,
    NULL::date,
    'effective_party'::text
  )::jsonb
) AS top_level_key;

SELECT
  (public.get_unified_party_ledger(
    '30bd8592-3384-4f34-899a-f3907e336485'::uuid,
    'customer'::text,
    'fe7ec33d-fd6d-4aa6-8d21-416e383b4c93'::uuid,
    NULL::uuid,
    NULL::date,
    NULL::date,
    'effective_party'::text
  )::jsonb -> 'summary' ->> 'closingBalance') AS summary_closing,
  (SELECT (elem->>'running_balance')::numeric
   FROM jsonb_array_elements(
     (public.get_unified_party_ledger(
       '30bd8592-3384-4f34-899a-f3907e336485'::uuid,
       'customer'::text,
       'fe7ec33d-fd6d-4aa6-8d21-416e383b4c93'::uuid,
       NULL::uuid,
       NULL::date,
       NULL::date,
       'effective_party'::text
     )::jsonb -> 'rows')
   ) AS elem
   ORDER BY (elem->>'entry_date') DESC, (elem->>'entry_no') DESC
   LIMIT 1) AS last_row_running_balance;
