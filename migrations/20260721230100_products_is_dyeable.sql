-- Additive: mark products eligible as dyeable / white fabric for bespoke fabric picker.

SET search_path = public;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_dyeable boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.products.is_dyeable IS
  'When true, product appears in bespoke customize fabric picker (white/dyeable fabrics).';

CREATE INDEX IF NOT EXISTS idx_products_company_is_dyeable
  ON public.products (company_id)
  WHERE is_dyeable = true;
