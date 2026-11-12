-- Phase 2.14 post-verify (read-only)
SELECT feature_key, enabled, updated_at
FROM feature_flags
WHERE company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND feature_key IN (
    'unified_ledger_pilot',
    'unified_ledger_engine',
    'unified_ledger_screen_roznamcha',
    'unified_ledger_loader_roznamcha',
    'unified_ledger_screen_ledger_v2',
    'unified_ledger_loader_ledger_v2',
    'unified_ledger_screen_account_statement',
    'unified_ledger_loader_account_statement',
    'unified_ledger_screen_trial_balance',
    'unified_ledger_loader_trial_balance',
    'unified_ledger_screen_party_ledger',
    'unified_ledger_loader_party_ledger',
    'unified_ledger_loader_cash_bank',
    'unified_ledger_screen_cash_bank'
  )
ORDER BY feature_key;
