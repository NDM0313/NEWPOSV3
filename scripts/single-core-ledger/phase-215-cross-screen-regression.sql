-- Phase 2.15 cross-screen regression gates
\echo '=== trial_balance ==='
SELECT
  ROUND((data->>'total_debit')::numeric, 2) AS total_debit,
  ROUND((data->>'total_credit')::numeric, 2) AS total_credit,
  ROUND((data->>'difference')::numeric, 2) AS difference
FROM (
  SELECT public.get_unified_trial_balance(
    '30bd8592-3384-4f34-899a-f3907e336485'::uuid,
    NULL::uuid,
    NULL::date,
    'official_gl'
  ) AS data
) q;

\echo '=== mr_jalil_party_ledger ==='
SELECT ROUND((data->>'period_closing_balance')::numeric, 2) AS closing
FROM (
  SELECT public.get_unified_party_ledger(
    '30bd8592-3384-4f34-899a-f3907e336485'::uuid,
    'customer',
    'fe7ec33d-fd6d-4aa6-8d21-416e383b4c93'::uuid,
    NULL::uuid,
    NULL::date,
    NULL::date,
    'effective_party'
  ) AS data
) q;
