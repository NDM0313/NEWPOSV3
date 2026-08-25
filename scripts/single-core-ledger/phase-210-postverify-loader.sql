-- Phase 2.10A — post-enable verify DIN CHINA loader flag (read-only)
SELECT feature_key, enabled, updated_at
FROM feature_flags
WHERE company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND feature_key IN (
    'unified_ledger_pilot',
    'unified_ledger_engine',
    'unified_ledger_screen_ledger_v2',
    'unified_ledger_loader_ledger_v2',
    'unified_ledger_kill_switch'
  )
ORDER BY feature_key;

-- Cross-company guard: loader flag must NOT appear on other companies
SELECT company_id, feature_key, enabled
FROM feature_flags
WHERE feature_key = 'unified_ledger_loader_ledger_v2'
  AND company_id <> '30bd8592-3384-4f34-899a-f3907e336485';
