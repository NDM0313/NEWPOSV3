-- ============================================
-- PART 1 – COMPANIES TABLE FINALIZATION
-- ============================================
-- Backend alignment: ensure companies has currency, financial_year_start,
-- timezone, date_format, decimal_precision for frontend SettingsContext.
-- Safe to run: ADD COLUMN IF NOT EXISTS.

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'PKR',
  ADD COLUMN IF NOT EXISTS financial_year_start DATE DEFAULT '2024-01-01',
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(64) DEFAULT 'Asia/Karachi',
  ADD COLUMN IF NOT EXISTS date_format VARCHAR(32) DEFAULT 'DD/MM/YYYY',
  ADD COLUMN IF NOT EXISTS decimal_precision INTEGER DEFAULT 2;

COMMENT ON COLUMN companies.currency IS 'Company currency code e.g. PKR, USD';
COMMENT ON COLUMN companies.financial_year_start IS 'First day of financial year (YYYY-MM-DD)';
COMMENT ON COLUMN companies.timezone IS 'IANA timezone e.g. Asia/Karachi';
COMMENT ON COLUMN companies.date_format IS 'Display format e.g. DD/MM/YYYY';
COMMENT ON COLUMN companies.decimal_precision IS 'Decimal places for currency display';
