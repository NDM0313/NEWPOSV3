-- Allow voided sale returns (app voidSaleReturn + audit trail).
ALTER TABLE public.sale_returns DROP CONSTRAINT IF EXISTS sale_returns_status_check;
ALTER TABLE public.sale_returns ADD CONSTRAINT sale_returns_status_check
  CHECK (status IN ('draft', 'final', 'void'));
