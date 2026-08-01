-- Phase 2.11 — enable Account Statement loader flag (DIN CHINA only)

INSERT INTO feature_flags (company_id, feature_key, enabled, description)
VALUES (
  '30bd8592-3384-4f34-899a-f3907e336485',
  'unified_ledger_loader_account_statement',
  true,
  'Phase 2.11 — Account Statement unified main loader ON for DIN CHINA'
)
ON CONFLICT (company_id, feature_key)
DO UPDATE SET
  enabled = true,
  description = EXCLUDED.description,
  updated_at = now();
