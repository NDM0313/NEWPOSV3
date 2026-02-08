-- ============================================================================
-- ADD is_combo_product FIELD TO PRODUCTS TABLE
-- ============================================================================
-- This migration adds the is_combo_product boolean field to products table
-- to track which products are combo/bundle products (virtual - no stock)
-- ============================================================================

-- Add is_combo_product column
ALTER TABLE products
ADD COLUMN IF NOT EXISTS is_combo_product BOOLEAN NOT NULL DEFAULT false;

-- Add comment
COMMENT ON COLUMN products.is_combo_product IS 'True if this product is a combo/bundle. Combo products do NOT hold stock - stock is managed through component products.';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_products_is_combo_product 
ON products(company_id, is_combo_product) 
WHERE is_combo_product = true;

-- Update existing combo products (if any exist in product_combos)
UPDATE products p
SET is_combo_product = true
WHERE EXISTS (
  SELECT 1 
  FROM product_combos pc 
  WHERE pc.combo_product_id = p.id 
  AND pc.company_id = p.company_id
  AND pc.is_active = true
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Check if column was added:
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'products' AND column_name = 'is_combo_product';
-- ============================================================================
