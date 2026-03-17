-- Persist Pricing Calculator: profit margin mode and value so they survive navigation.
-- Safe to run multiple times.
ALTER TABLE studio_productions
  ADD COLUMN IF NOT EXISTS profit_margin_mode TEXT DEFAULT 'percentage';

ALTER TABLE studio_productions
  ADD COLUMN IF NOT EXISTS profit_margin_value NUMERIC(15,2) DEFAULT 30;

COMMENT ON COLUMN studio_productions.profit_margin_mode IS 'Pricing Calculator: percentage or fixed';
COMMENT ON COLUMN studio_productions.profit_margin_value IS 'Pricing Calculator: margin % or fixed amount';
