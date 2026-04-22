-- Allow rental_items to reference a specific product variation.
-- Safe / idempotent: only adds the column if missing.

ALTER TABLE public.rental_items
  ADD COLUMN IF NOT EXISTS variation_id UUID REFERENCES public.product_variations(id);

CREATE INDEX IF NOT EXISTS idx_rental_items_variation_id
  ON public.rental_items(variation_id) WHERE variation_id IS NOT NULL;

COMMENT ON COLUMN public.rental_items.variation_id IS
  'Optional: when the product has variations, the specific variation rented.';
