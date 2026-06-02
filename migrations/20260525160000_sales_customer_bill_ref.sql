-- Mobile / web parity: customer bill book reference separate from sale notes.
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS customer_bill_ref TEXT;

COMMENT ON COLUMN public.sales.customer_bill_ref IS
  'Manual customer bill / REF # (not payment reference_number, not free-form notes).';
