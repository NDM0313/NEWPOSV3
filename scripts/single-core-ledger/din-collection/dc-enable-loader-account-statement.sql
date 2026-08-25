-- DIN COLLECTION — Account Statement unified main loader (parity with LV2 / other companies)
INSERT INTO feature_flags (company_id, feature_key, enabled, description)
VALUES (
  'e08a04af-22a8-4869-9b4d-da31fce13158',
  'unified_ledger_loader_account_statement',
  true,
  'DIN COLLECTION — Account Statement unified main loader'
)
ON CONFLICT (company_id, feature_key)
DO UPDATE SET enabled = true, description = EXCLUDED.description, updated_at = now();
