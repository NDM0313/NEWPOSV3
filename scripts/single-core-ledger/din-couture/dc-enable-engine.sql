-- DIN COUTURE DIN COUTURE Step 2 — unified_ledger_engine
-- DO NOT RUN until finance sign-off + pilot gate PASS
INSERT INTO feature_flags (company_id, feature_key, enabled, description)
VALUES (
  '2ab65903-62a3-4bcf-bced-076b681e9b74',
  'unified_ledger_engine',
  true,
  'DIN COUTURE DIN COUTURE — unified ledger engine ON'
)
ON CONFLICT (company_id, feature_key)
DO UPDATE SET enabled = true, description = EXCLUDED.description, updated_at = now();

