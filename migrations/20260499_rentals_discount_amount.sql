-- Optional rental discount (Dr Discount Allowed / Cr AR when > 0)
ALTER TABLE public.rentals
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.rentals.discount_amount IS 'Rental discount; GL posted via rental_party_discount fingerprint when party AR model applies.';
