-- Optional: default commission % per salesman (used when creating/editing sales).
-- SaleForm uses this when a salesman is selected so new sales get the default; admin can override per sale.
-- Pending (unposted) sales are not auto-updated when this changes; use a controlled recalc action if needed.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS default_commission_percent DECIMAL(5,2) DEFAULT NULL;
COMMENT ON COLUMN public.users.default_commission_percent IS 'Default commission % for this user when assigned as salesman; used in SaleForm. Null = no default.';
