-- Phase 2.10D — DIN CHINA controlled loader soak enable

INSERT INTO feature_flags (company_id, feature_key, enabled, description)
VALUES (
  '30bd8592-3384-4f34-899a-f3907e336485',
  'unified_ledger_loader_ledger_v2',
  true,
  'Phase 2.10D controlled soak — Ledger V2 unified main loader on preview-approved DIN CHINA scope'
)
ON CONFLICT (company_id, feature_key)
DO UPDATE SET
  enabled = true,
  description = EXCLUDED.description,
  updated_at = now();
