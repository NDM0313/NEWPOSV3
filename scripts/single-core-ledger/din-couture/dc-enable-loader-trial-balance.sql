INSERT INTO feature_flags (company_id, feature_key, enabled, description)
VALUES ('2ab65903-62a3-4bcf-bced-076b681e9b74', 'unified_ledger_loader_trial_balance', true, 'DIN COUTURE DIN COUTURE — Trial Balance unified main loader')
ON CONFLICT (company_id, feature_key) DO UPDATE SET enabled = true, description = EXCLUDED.description, updated_at = now();

