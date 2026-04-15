-- Repair: deduplicate stock_movements for sales that have duplicate entries from app + DB trigger race.
-- For each (reference_type='sale', reference_id, product_id, variation_id, movement_type='sale'),
-- keep the oldest row and delete extras. Then re-check SALE_CANCELLED to match.
-- Idempotent: safe to run multiple times.

-- Step 1: Remove duplicate 'sale' movements (keep oldest per product/variation per sale)
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY reference_id, product_id, COALESCE(variation_id, '00000000-0000-0000-0000-000000000000'), movement_type
           ORDER BY created_at ASC
         ) AS rn
  FROM public.stock_movements
  WHERE reference_type = 'sale'
    AND LOWER(TRIM(movement_type)) = 'sale'
)
DELETE FROM public.stock_movements
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Step 2: Remove duplicate 'sale_cancelled' movements (keep oldest per product/variation per sale)
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY reference_id, product_id, COALESCE(variation_id, '00000000-0000-0000-0000-000000000000'), movement_type
           ORDER BY created_at ASC
         ) AS rn
  FROM public.stock_movements
  WHERE reference_type = 'sale'
    AND LOWER(TRIM(movement_type)) = 'sale_cancelled'
)
DELETE FROM public.stock_movements
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Step 3: Remove sync-generated 'sale' movements with positive quantity (these are reconciliation artifacts)
-- Real sale movements always have negative quantity; positive 'sale' entries are from sync trying to fix doubles.
DELETE FROM public.stock_movements
WHERE reference_type = 'sale'
  AND LOWER(TRIM(movement_type)) = 'sale'
  AND quantity > 0
  AND notes LIKE 'Stock sync%';
