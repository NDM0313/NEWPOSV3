-- Sales: add salesman and commission columns for period-based commission reporting.
-- Sale-level capture: salesman_id, commission_amount (and optionally commission_eligible_amount).
-- Safe to run multiple times (IF NOT EXISTS).

ALTER TABLE sales ADD COLUMN IF NOT EXISTS salesman_id UUID;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(15,2) DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS commission_eligible_amount DECIMAL(15,2);

COMMENT ON COLUMN sales.salesman_id IS 'User (salesperson) assigned to this sale for commission';
COMMENT ON COLUMN sales.commission_amount IS 'Commission amount for this sale (stored for period reporting)';
COMMENT ON COLUMN sales.commission_eligible_amount IS 'Amount used as base for commission (e.g. subtotal before extras)';

CREATE INDEX IF NOT EXISTS idx_sales_salesman_id ON sales(salesman_id) WHERE salesman_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_commission_period ON sales(company_id, invoice_date) WHERE status = 'final' AND commission_amount > 0;
