-- Prevent duplicate sale_return_void rows (race / double void) per return line identity.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY company_id, reference_id, product_id, COALESCE(variation_id, '00000000-0000-0000-0000-000000000000'::uuid)
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM public.stock_movements
  WHERE reference_type = 'sale_return'
    AND movement_type = 'sale_return_void'
)
DELETE FROM public.stock_movements sm
USING ranked r
WHERE sm.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS ux_stock_movements_sale_return_void_one_per_line
ON public.stock_movements (
  company_id,
  reference_id,
  product_id,
  (COALESCE(variation_id, '00000000-0000-0000-0000-000000000000'::uuid))
)
WHERE reference_type = 'sale_return' AND movement_type = 'sale_return_void';
