-- Phase 2.12X closeout — all unified_ledger flags (read-only)
SELECT company_id, feature_key, enabled, updated_at
FROM feature_flags
WHERE feature_key LIKE 'unified_ledger%'
ORDER BY company_id, feature_key;

-- Loader flags on non-DIN-CHINA companies (should be empty)
SELECT company_id, feature_key, enabled
FROM feature_flags
WHERE feature_key LIKE 'unified_ledger_loader_%'
  AND company_id <> '30bd8592-3384-4f34-899a-f3907e336485';

-- Forbidden screen flags for DIN CHINA (should be absent or false)
SELECT feature_key, enabled
FROM feature_flags
WHERE company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND feature_key IN (
    'unified_ledger_screen_roznamcha',
    'unified_ledger_screen_party_ledger',
    'unified_ledger_screen_cash_bank',
    'unified_ledger_loader_cash_bank',
    'unified_ledger_kill_switch'
  );
