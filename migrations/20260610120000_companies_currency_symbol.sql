-- Display-only: custom currency symbol and show/hide toggle for company-wide formatting.
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS currency_symbol TEXT,
  ADD COLUMN IF NOT EXISTS show_currency_symbol BOOLEAN NOT NULL DEFAULT true;
