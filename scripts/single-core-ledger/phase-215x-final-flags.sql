-- Phase 2.15X — read-only production flag verification (DIN CHINA)
SELECT company_id, feature_key, enabled, updated_at
FROM feature_flags
WHERE company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND feature_key LIKE 'unified_ledger%'
ORDER BY feature_key;

SELECT company_id, feature_key, enabled
FROM feature_flags
WHERE feature_key LIKE 'unified_ledger_loader%'
  AND enabled = true
  AND company_id != '30bd8592-3384-4f34-899a-f3907e336485';

SELECT feature_key, COUNT(*) FILTER (WHERE enabled) AS enabled_count
FROM feature_flags
WHERE feature_key LIKE '%cash%bank%' OR feature_key LIKE '%roznamcha%'
GROUP BY feature_key
ORDER BY feature_key;
