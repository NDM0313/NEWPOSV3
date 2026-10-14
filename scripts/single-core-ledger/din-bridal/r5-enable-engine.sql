-- DIN BRIDAL R5 Step 2 — unified_ledger_engine
-- DO NOT RUN until finance sign-off + pilot gate PASS
INSERT INTO feature_flags (company_id, feature_key, enabled, description)
VALUES (
  '597a5292-14c8-4cd8-96bd-c61b5a0d8c92',
  'unified_ledger_engine',
  true,
  'R5 DIN BRIDAL — unified ledger engine ON'
)
ON CONFLICT (company_id, feature_key)
DO UPDATE SET enabled = true, description = EXCLUDED.description, updated_at = now();
