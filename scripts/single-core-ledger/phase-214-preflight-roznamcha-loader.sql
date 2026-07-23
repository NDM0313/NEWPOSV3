-- Phase 2.14 preflight (read-only)
SELECT feature_key, enabled, updated_at
FROM feature_flags
WHERE company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND feature_key LIKE 'unified_ledger%'
ORDER BY feature_key;

SELECT company_id, feature_key, enabled, updated_at
FROM feature_flags
WHERE feature_key IN (
  'unified_ledger_loader_roznamcha',
  'unified_ledger_screen_roznamcha'
)
ORDER BY company_id, feature_key;
