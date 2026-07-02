-- R5 cross-company loader guard (read-only)
-- Expect: only target company has unified_ledger_loader_* ON after staged rollout.

\echo '=== All unified_ledger_loader_* flags by company ==='
SELECT c.name, ff.company_id, ff.feature_key, ff.enabled, ff.updated_at
FROM feature_flags ff
JOIN companies c ON c.id = ff.company_id
WHERE ff.feature_key LIKE 'unified_ledger_loader_%'
ORDER BY c.name, ff.feature_key;

\echo '=== Companies with any loader ON (should be 1 after R5 complete) ==='
SELECT c.name, COUNT(*) FILTER (WHERE ff.enabled) AS loaders_on
FROM companies c
LEFT JOIN feature_flags ff ON ff.company_id = c.id AND ff.feature_key LIKE 'unified_ledger_loader_%'
GROUP BY c.name
HAVING COUNT(*) FILTER (WHERE ff.enabled) > 0
ORDER BY c.name;
