-- ============================================================================
-- STUDIO PRODUCTIONS: pricing columns for persistence and reporting
-- ============================================================================
-- Persist Pricing Calculator: profit_margin_percent, sale_price, profit_amount.
-- Does NOT modify inventory or accounting triggers.
-- ============================================================================

ALTER TABLE studio_productions
  ADD COLUMN IF NOT EXISTS profit_margin_percent NUMERIC(8,2);

ALTER TABLE studio_productions
  ADD COLUMN IF NOT EXISTS sale_price NUMERIC(15,2);

ALTER TABLE studio_productions
  ADD COLUMN IF NOT EXISTS profit_amount NUMERIC(15,2);

COMMENT ON COLUMN studio_productions.profit_margin_percent IS 'Pricing Calculator: profit margin % (e.g. 30 = 30%).';
COMMENT ON COLUMN studio_productions.sale_price IS 'Pricing Calculator: sale_price = actual_cost * (1 + profit_margin_percent/100).';
COMMENT ON COLUMN studio_productions.profit_amount IS 'Pricing Calculator: profit_amount = actual_cost * profit_margin_percent/100.';
