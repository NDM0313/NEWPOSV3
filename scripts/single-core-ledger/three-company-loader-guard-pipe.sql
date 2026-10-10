-- Three-company baseline — read-only loader guard (pipe-friendly)
SELECT c.name, COUNT(*) FILTER (WHERE ff.enabled) AS loaders_on
FROM companies c
LEFT JOIN feature_flags ff ON ff.company_id = c.id AND ff.feature_key LIKE 'unified_ledger_loader_%'
GROUP BY c.name
HAVING COUNT(*) FILTER (WHERE ff.enabled) > 0
ORDER BY c.name;
