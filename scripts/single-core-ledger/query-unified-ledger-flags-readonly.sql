-- Read-only: unified ledger feature flags audit
SELECT company_id::text, feature_key, enabled
FROM feature_flags
WHERE feature_key LIKE 'unified_ledger%'
ORDER BY company_id, feature_key;
