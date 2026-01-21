-- Fix company_id mismatches in stock_movements table
-- This migration updates all stock_movements to have the correct company_id from their associated products

-- Step 1: Update stock_movements.company_id to match products.company_id
UPDATE stock_movements
SET company_id = (
  SELECT company_id 
  FROM products 
  WHERE products.id = stock_movements.product_id
)
WHERE EXISTS (
  SELECT 1 
  FROM products 
  WHERE products.id = stock_movements.product_id
  AND products.company_id != stock_movements.company_id
);

-- Step 2: Verify the fix
-- This query should return 0 rows if all company_ids are now correct
SELECT 
  sm.id,
  sm.product_id,
  sm.company_id as movement_company_id,
  p.company_id as product_company_id,
  p.name as product_name
FROM stock_movements sm
INNER JOIN products p ON p.id = sm.product_id
WHERE sm.company_id != p.company_id;

-- Step 3: Add a constraint to prevent future mismatches (optional, can be enabled later)
-- ALTER TABLE stock_movements
-- ADD CONSTRAINT check_company_id_match 
-- CHECK (
--   company_id = (SELECT company_id FROM products WHERE id = product_id)
-- );
