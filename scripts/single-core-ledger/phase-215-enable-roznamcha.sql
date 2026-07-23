INSERT INTO feature_flags (company_id, feature_key, enabled, description)
VALUES (
  '30bd8592-3384-4f34-899a-f3907e336485',
  'unified_ledger_loader_roznamcha',
  true,
  'Phase 2.15 — Roznamcha unified main loader ON for DIN CHINA (parity fix)'
)
ON CONFLICT (company_id, feature_key)
DO UPDATE SET enabled = true, description = EXCLUDED.description, updated_at = now();

INSERT INTO feature_flags (company_id, feature_key, enabled, description)
VALUES (
  '30bd8592-3384-4f34-899a-f3907e336485',
  'unified_ledger_screen_roznamcha',
  true,
  'Phase 2.15 — Roznamcha screen flag ON for DIN CHINA (parity fix)'
)
ON CONFLICT (company_id, feature_key)
DO UPDATE SET enabled = true, description = EXCLUDED.description, updated_at = now();

SELECT feature_key, enabled, updated_at
FROM feature_flags
WHERE company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND feature_key IN ('unified_ledger_loader_roznamcha', 'unified_ledger_screen_roznamcha');
