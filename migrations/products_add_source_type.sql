-- Add source_type column to products table
-- Tracks which module created the product
-- Values: 'studio' | 'manual' | 'purchase' | 'pos'
-- Default is 'manual' so all existing products are unaffected

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'manual'
  CHECK (source_type IN ('studio', 'manual', 'purchase', 'pos'));

-- Index for fast filtering in the Studio product selector
CREATE INDEX IF NOT EXISTS idx_products_source_type
  ON products (company_id, source_type)
  WHERE is_active = true;

-- Backfill: products already created via Studio production (product_type = 'production')
-- are retroactively marked as studio-sourced
UPDATE products
SET source_type = 'studio'
WHERE product_type = 'production'
  AND source_type = 'manual';

COMMENT ON COLUMN products.source_type IS
  'Origin module that created this product.
   studio   – created from Studio production workflow
   manual   – created manually in Products module
   purchase – auto-created from a Purchase order
   pos      – created directly from POS terminal';
