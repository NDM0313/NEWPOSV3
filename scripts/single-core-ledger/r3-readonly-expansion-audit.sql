-- R3 read-only expansion audit (no writes)
\echo '=== Companies ==='
SELECT id, name, COALESCE(is_active, true) AS is_active
FROM companies
ORDER BY name;

\echo '=== Branches per company ==='
SELECT c.name AS company, b.id AS branch_id, b.name AS branch_name
FROM branches b
JOIN companies c ON c.id = b.company_id
ORDER BY c.name, b.name;

\echo '=== Unified ledger flags (all companies) ==='
SELECT c.name, ff.company_id, ff.feature_key, ff.enabled
FROM feature_flags ff
JOIN companies c ON c.id = ff.company_id
WHERE ff.feature_key LIKE 'unified_ledger%'
ORDER BY c.name, ff.feature_key;

\echo '=== Other-company loader flags enabled (must be 0) ==='
SELECT c.name, ff.feature_key
FROM feature_flags ff
JOIN companies c ON c.id = ff.company_id
WHERE ff.company_id != '30bd8592-3384-4f34-899a-f3907e336485'
  AND ff.feature_key LIKE 'unified_ledger_loader_%'
  AND ff.enabled = true;

\echo '=== DIN CHINA loader flags (reference) ==='
SELECT feature_key, enabled
FROM feature_flags
WHERE company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND feature_key LIKE 'unified_ledger%'
ORDER BY feature_key;

\echo '=== Per-company GL activity (non-void journal entries) ==='
SELECT c.name, COUNT(je.id) AS je_count
FROM companies c
LEFT JOIN journal_entries je ON je.company_id = c.id AND COALESCE(je.is_void, false) = false
GROUP BY c.name
ORDER BY c.name;

\echo '=== Per-company feature flag row count (unified_ledger*) ==='
SELECT c.name, COUNT(ff.feature_key) AS unified_flag_rows
FROM companies c
LEFT JOIN feature_flags ff ON ff.company_id = c.id AND ff.feature_key LIKE 'unified_ledger%'
GROUP BY c.name
ORDER BY c.name;
