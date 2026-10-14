-- Read-only MR JALIL unified closing (Phase 2.9A ops check)
SELECT
  (public.get_unified_party_ledger(
    '30bd8592-3384-4f34-899a-f3907e336485'::uuid,
    'customer'::text,
    'fe7ec33d-fd6d-4aa6-8d21-416e383b4c93'::uuid,
    NULL::uuid,
    NULL::date,
    NULL::date,
    'effective_party'::text
  )->>'closingBalance')::numeric AS unified_closing;

SELECT proname
FROM pg_proc
WHERE proname IN ('get_unified_party_ledger', 'get_unified_account_ledger')
ORDER BY 1;
