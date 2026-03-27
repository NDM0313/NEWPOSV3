-- Payee / vendor label on expense rows (ExpenseContext maps payeeName ↔ vendor_name).
-- Some deployments never had this column; app update fails with schema cache error without it.

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS vendor_name VARCHAR(255);

COMMENT ON COLUMN public.expenses.vendor_name IS 'Optional payee or vendor display name';
