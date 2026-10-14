-- Phase 3B-M — enable Cash Flow unified screen gate (all three companies)
-- Run AFTER frontend deploy, BEFORE loader flag.

INSERT INTO feature_flags (company_id, feature_key, enabled, description)
VALUES
  ('30bd8592-3384-4f34-899a-f3907e336485', 'unified_ledger_screen_cash_flow', true, 'DIN CHINA — Cash Flow unified screen'),
  ('597a5292-14c8-4cd8-96bd-c61b5a0d8c92', 'unified_ledger_screen_cash_flow', true, 'DIN BRIDAL — Cash Flow unified screen'),
  ('2ab65903-62a3-4bcf-bced-076b681e9b74', 'unified_ledger_screen_cash_flow', true, 'DIN COUTURE — Cash Flow unified screen')
ON CONFLICT (company_id, feature_key) DO UPDATE SET enabled = true, description = EXCLUDED.description, updated_at = now();
