-- DIN BRIDAL R5 — unified_ledger_screen_ledger_v2 (DO NOT RUN until finance sign-off)
INSERT INTO feature_flags (company_id, feature_key, enabled, description)
VALUES ('597a5292-14c8-4cd8-96bd-c61b5a0d8c92', 'unified_ledger_screen_ledger_v2', true, 'R5 DIN BRIDAL — Ledger V2 unified screen')
ON CONFLICT (company_id, feature_key) DO UPDATE SET enabled = true, description = EXCLUDED.description, updated_at = now();
