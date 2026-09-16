-- Verify Phase 1.5 unified ledger functions exist (run against staging clone only).
SELECT proname AS function_name
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND proname IN (
    'get_unified_party_ledger',
    'get_unified_account_ledger',
    'get_unified_cash_bank_ledger',
    'get_unified_trial_balance',
    'get_single_core_ledger_systemwide_diagnostics'
  )
ORDER BY 1;
