-- DIN COUTURE DIN COUTURE Step 1 — unified_ledger_pilot
-- DO NOT RUN until finance sign-off recorded in reports/single-core-ledger/din-bridal/golden-fixtures.json
INSERT INTO feature_flags (company_id, feature_key, enabled, description)
VALUES (
  '2ab65903-62a3-4bcf-bced-076b681e9b74',
  'unified_ledger_pilot',
  true,
  'DIN COUTURE DIN COUTURE — pilot scope for unified ledger Admin Compare'
)
ON CONFLICT (company_id, feature_key)
DO UPDATE SET enabled = true, description = EXCLUDED.description, updated_at = now();

