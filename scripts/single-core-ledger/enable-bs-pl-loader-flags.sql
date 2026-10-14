-- Phase 3D — enable BS/P&L unified main loaders (all three companies)
-- Run AFTER frontend deploy + pre-flag smoke PASS.

INSERT INTO feature_flags (company_id, feature_key, enabled, description)
VALUES
  ('30bd8592-3384-4f34-899a-f3907e336485', 'unified_ledger_loader_balance_sheet', true, 'DIN CHINA — Balance Sheet unified main loader'),
  ('30bd8592-3384-4f34-899a-f3907e336485', 'unified_ledger_loader_profit_loss', true, 'DIN CHINA — P&L unified main loader'),
  ('30bd8592-3384-4f34-899a-f3907e336485', 'unified_ledger_screen_balance_sheet', true, 'DIN CHINA — Balance Sheet unified screen'),
  ('30bd8592-3384-4f34-899a-f3907e336485', 'unified_ledger_screen_profit_loss', true, 'DIN CHINA — P&L unified screen'),
  ('597a5292-14c8-4cd8-96bd-c61b5a0d8c92', 'unified_ledger_loader_balance_sheet', true, 'DIN BRIDAL — Balance Sheet unified main loader'),
  ('597a5292-14c8-4cd8-96bd-c61b5a0d8c92', 'unified_ledger_loader_profit_loss', true, 'DIN BRIDAL — P&L unified main loader'),
  ('597a5292-14c8-4cd8-96bd-c61b5a0d8c92', 'unified_ledger_screen_balance_sheet', true, 'DIN BRIDAL — Balance Sheet unified screen'),
  ('597a5292-14c8-4cd8-96bd-c61b5a0d8c92', 'unified_ledger_screen_profit_loss', true, 'DIN BRIDAL — P&L unified screen'),
  ('2ab65903-62a3-4bcf-bced-076b681e9b74', 'unified_ledger_loader_balance_sheet', true, 'DIN COUTURE — Balance Sheet unified main loader'),
  ('2ab65903-62a3-4bcf-bced-076b681e9b74', 'unified_ledger_loader_profit_loss', true, 'DIN COUTURE — P&L unified main loader'),
  ('2ab65903-62a3-4bcf-bced-076b681e9b74', 'unified_ledger_screen_balance_sheet', true, 'DIN COUTURE — Balance Sheet unified screen'),
  ('2ab65903-62a3-4bcf-bced-076b681e9b74', 'unified_ledger_screen_profit_loss', true, 'DIN COUTURE — P&L unified screen')
ON CONFLICT (company_id, feature_key) DO UPDATE SET enabled = true, description = EXCLUDED.description, updated_at = now();
