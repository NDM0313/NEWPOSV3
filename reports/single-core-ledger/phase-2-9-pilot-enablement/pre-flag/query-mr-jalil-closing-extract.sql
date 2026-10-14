SELECT
  (public.get_unified_party_ledger(
    '30bd8592-3384-4f34-899a-f3907e336485'::uuid,
    'customer'::text,
    'fe7ec33d-fd6d-4aa6-8d21-416e383b4c93'::uuid,
    NULL::uuid,
    NULL::date,
    NULL::date,
    'effective_party'::text
  )::jsonb -> 'closingBalance') AS closing_balance_json,
  (public.get_unified_party_ledger(
    '30bd8592-3384-4f34-899a-f3907e336485'::uuid,
    'customer'::text,
    'fe7ec33d-fd6d-4aa6-8d21-416e383b4c93'::uuid,
    NULL::uuid,
    NULL::date,
    NULL::date,
    'effective_party'::text
  )::jsonb -> 'meta' ->> 'engine') AS meta_engine;
