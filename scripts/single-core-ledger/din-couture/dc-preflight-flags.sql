-- DIN COUTURE DIN COUTURE — preflight flags (read-only)
-- DO NOT RUN enable scripts until finance sign-off in golden-fixtures.json

\echo '=== DIN COUTURE unified_ledger flags ==='
SELECT feature_key, enabled, updated_at
FROM feature_flags
WHERE company_id = '2ab65903-62a3-4bcf-bced-076b681e9b74'
  AND feature_key LIKE 'unified_ledger%'
ORDER BY feature_key;

\echo '=== Other companies with loader flags ON (excluding DIN CHINA + DIN BRIDAL — expected) ==='
SELECT c.name, ff.feature_key, ff.enabled
FROM feature_flags ff
JOIN companies c ON c.id = ff.company_id
WHERE ff.company_id NOT IN (
  '2ab65903-62a3-4bcf-bced-076b681e9b74'::uuid,
  '30bd8592-3384-4f34-899a-f3907e336485'::uuid,
  '597a5292-14c8-4cd8-96bd-c61b5a0d8c92'::uuid
)
  AND ff.feature_key LIKE 'unified_ledger_loader_%'
  AND ff.enabled = true;

\echo '=== DIN CHINA reference (must stay ON) ==='
SELECT feature_key, enabled
FROM feature_flags
WHERE company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND feature_key LIKE 'unified_ledger%'
ORDER BY feature_key;

