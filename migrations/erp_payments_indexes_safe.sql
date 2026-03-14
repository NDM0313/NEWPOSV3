-- ERP Final Stabilization: Payments table indexes (safe, idempotent).
-- Only creates indexes if they do not already exist.
-- Run after verifying: SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'payments';

-- company_id (list/filter by company)
CREATE INDEX IF NOT EXISTS idx_payments_company_id ON payments(company_id);

-- company_id + payment_date (date-range reports and lists)
CREATE INDEX IF NOT EXISTS idx_payments_company_payment_date ON payments(company_id, payment_date);

-- company_id + created_at (recent-activity and audit)
CREATE INDEX IF NOT EXISTS idx_payments_company_created_at ON payments(company_id, created_at);

-- reference_type + reference_id (lookup by sale/purchase/expense/rental)
CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments(reference_type, reference_id);

COMMENT ON INDEX idx_payments_company_id IS 'ERP stabilization: list payments by company';
COMMENT ON INDEX idx_payments_company_payment_date IS 'ERP stabilization: date-range filters';
COMMENT ON INDEX idx_payments_company_created_at IS 'ERP stabilization: recent activity';
COMMENT ON INDEX idx_payments_reference IS 'ERP stabilization: lookup by reference (sale, purchase, etc.)';
