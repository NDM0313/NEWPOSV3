-- Rental Commission Support
-- Add commission columns to rentals table (mirrors sales commission pattern)

ALTER TABLE rentals
  ADD COLUMN IF NOT EXISTS salesman_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_percent DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS commission_eligible_amount DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS commission_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS commission_batch_id UUID;

-- Per-salesman rental commission rate (separate from sales default_commission_percent)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS rental_commission_percent DECIMAL(5,2);

-- Indexes for commission report queries
CREATE INDEX IF NOT EXISTS idx_rentals_commission_period
  ON rentals(company_id, booking_date) WHERE commission_amount > 0;
CREATE INDEX IF NOT EXISTS idx_rentals_commission_status
  ON rentals(company_id, commission_status) WHERE commission_amount > 0;
