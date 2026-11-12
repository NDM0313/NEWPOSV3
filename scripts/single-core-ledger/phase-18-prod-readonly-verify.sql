-- Phase 1.8 — production read-only verification (postgres)
\echo '=== phase15_schema_migrations ==='
SELECT name FROM schema_migrations
WHERE name IN (
  '20260620140000_get_unified_party_ledger_shadow.sql',
  '20260621120000_single_core_ledger_systemwide_diagnostics.sql',
  '20260621150000_unified_ledger_phase_15_rpcs.sql',
  '20260621151000_unified_ledger_phase_15_indexes.sql'
)
ORDER BY name;

\echo '=== unified_rpcs ==='
SELECT proname FROM pg_proc
WHERE proname IN (
  'get_unified_party_ledger',
  'get_unified_account_ledger',
  'get_unified_cash_bank_ledger',
  'get_unified_trial_balance',
  'get_single_core_ledger_systemwide_diagnostics'
)
ORDER BY 1;

\echo '=== unified_engine_flag ==='
SELECT coalesce(ff.enabled::text, 'absent') AS flag_state
FROM (SELECT 1) x
LEFT JOIN feature_flags ff
  ON ff.feature_key = 'unified_ledger_engine'
 AND ff.company_id = '30bd8592-3384-4f34-899a-f3907e336485'::uuid;

\echo '=== mr_jalil_gl_ar ==='
SELECT b.gl_ar_receivable
FROM get_contact_party_gl_balances(
  '30bd8592-3384-4f34-899a-f3907e336485'::uuid,
  NULL::uuid,
  NULL::date
) b
WHERE b.contact_id = 'fe7ec33d-fd6d-4aa6-8d21-416e383b4c93'::uuid;
