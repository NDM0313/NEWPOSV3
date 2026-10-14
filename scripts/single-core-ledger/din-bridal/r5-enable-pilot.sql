-- DIN BRIDAL R5 Step 1 — unified_ledger_pilot
-- DO NOT RUN until finance sign-off recorded in reports/single-core-ledger/din-bridal/golden-fixtures.json
INSERT INTO feature_flags (company_id, feature_key, enabled, description)
VALUES (
  '597a5292-14c8-4cd8-96bd-c61b5a0d8c92',
  'unified_ledger_pilot',
  true,
  'R5 DIN BRIDAL — pilot scope for unified ledger Admin Compare'
)
ON CONFLICT (company_id, feature_key)
DO UPDATE SET enabled = true, description = EXCLUDED.description, updated_at = now();
