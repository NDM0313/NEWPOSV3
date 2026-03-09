-- ============================================================================
-- PRODUCTS: product_type for production vs normal (Studio Production accounting)
-- ============================================================================
-- production = manufactured from studio production (STD-PROD-xxxx), tracked in inventory.
-- normal = regular catalog products (PRD-xxxx).
-- ============================================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS product_type TEXT NOT NULL DEFAULT 'normal'
  CHECK (product_type IN ('normal', 'production'));

COMMENT ON COLUMN products.product_type IS 'normal = catalog product; production = manufactured from studio production (STD-PROD, inventory + cost).';

CREATE INDEX IF NOT EXISTS idx_products_product_type ON products(product_type) WHERE product_type = 'production';

-- Backfill: mark existing studio-generated products as production
UPDATE products p
SET product_type = 'production'
WHERE p.product_type = 'normal'
  AND (
    p.id IN (SELECT product_id FROM studio_production_orders_v2 WHERE product_id IS NOT NULL)
    OR p.sku ILIKE 'STUDIO-%'
    OR p.sku ILIKE 'STD-PROD-%'
  );
