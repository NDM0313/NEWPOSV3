-- Phase 2.10A Stage 3 — DIN CHINA loader flag ONLY (ops-approved execution)
-- DO NOT RUN until implementation pack + export spot-check signed off.
INSERT INTO feature_flags (company_id, feature_key, enabled, description)
VALUES (
  '30bd8592-3384-4f34-899a-f3907e336485',
  'unified_ledger_loader_ledger_v2',
  true,
  'Phase 2.10 DIN CHINA — Ledger V2 default main loader unified RPC'
)
ON CONFLICT (company_id, feature_key)
DO UPDATE SET
  enabled = true,
  description = EXCLUDED.description,
  updated_at = now();
