-- ============================================================================
-- STOCK LEDGER DATA VERIFICATION QUERIES
-- ============================================================================
-- Run these in Supabase SQL Editor to diagnose stock_movements data issue
-- ============================================================================

-- STEP 1: Check if table exists and total row count
-- ============================================================================
SELECT COUNT(*) as total_rows FROM stock_movements;

-- STEP 2: Check table structure (column names and types)
-- ============================================================================
SELECT 
    column_name, 
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'stock_movements'
ORDER BY ordinal_position;

-- STEP 3: Check for specific product (NO company_id filter)
-- ============================================================================
-- Product ID from console: 18fa8e97-86cd-41ce-afa5-ced19edf513c
SELECT 
    id,
    product_id,
    company_id,
    branch_id,
    movement_type,
    type,  -- In case column is named 'type' instead of 'movement_type'
    quantity,
    unit_cost,
    total_cost,
    reference_type,
    reference_id,
    created_at
FROM stock_movements
WHERE product_id = '18fa8e97-86cd-41ce-afa5-ced19edf513c'
ORDER BY created_at DESC
LIMIT 20;

-- STEP 4: Check for specific company (NO product_id filter)
-- ============================================================================
-- Company ID from console: 5aac3c47-af92-44f4-aa7d-4ca5bd4c135b
SELECT 
    id,
    product_id,
    company_id,
    branch_id,
    movement_type,
    type,
    quantity,
    created_at
FROM stock_movements
WHERE company_id = '5aac3c47-af92-44f4-aa7d-4ca5bd4c135b'
ORDER BY created_at DESC
LIMIT 20;

-- STEP 5: Check combined filter (product_id + company_id)
-- ============================================================================
SELECT 
    id,
    product_id,
    company_id,
    branch_id,
    movement_type,
    type,
    quantity,
    created_at
FROM stock_movements
WHERE product_id = '18fa8e97-86cd-41ce-afa5-ced19edf513c'
  AND company_id = '5aac3c47-af92-44f4-aa7d-4ca5bd4c135b'
ORDER BY created_at DESC
LIMIT 20;

-- STEP 6: Verify foreign key relationships
-- ============================================================================
-- Check if product exists
SELECT id, name, sku, company_id 
FROM products 
WHERE id = '18fa8e97-86cd-41ce-afa5-ced19edf513c';

-- Check if company exists
SELECT id, name 
FROM companies 
WHERE id = '5aac3c47-af92-44f4-aa7d-4ca5bd4c135b';

-- Check available branches for this company
SELECT id, name, company_id 
FROM branches 
WHERE company_id = '5aac3c47-af92-44f4-aa7d-4ca5bd4c135b'
ORDER BY name;

-- STEP 7: Check all distinct branch_ids in stock_movements
-- ============================================================================
SELECT DISTINCT branch_id, COUNT(*) as movement_count
FROM stock_movements
GROUP BY branch_id;

-- STEP 8: Sample data check (any 5 rows)
-- ============================================================================
SELECT 
    id,
    product_id,
    company_id,
    branch_id,
    movement_type,
    type,
    quantity,
    created_at
FROM stock_movements
ORDER BY created_at DESC
LIMIT 5;

-- ============================================================================
-- STEP 9: INSERT TEST DATA (ONLY IF TABLE IS EMPTY)
-- ============================================================================
-- ⚠️ WARNING: Only run this if stock_movements table is empty
-- ⚠️ This is for testing purposes only
-- 
-- First, get a valid branch_id for the company:
-- SELECT id FROM branches WHERE company_id = '5aac3c47-af92-44f4-aa7d-4ca5bd4c135b' LIMIT 1;
--
-- Then insert test data (replace <BRANCH_ID> with actual branch_id):
/*
INSERT INTO stock_movements (
    id,
    company_id,
    branch_id,
    product_id,
    movement_type,
    quantity,
    unit_cost,
    total_cost,
    reference_type,
    reference_id,
    created_at
) VALUES (
    gen_random_uuid(),
    '5aac3c47-af92-44f4-aa7d-4ca5bd4c135b',
    '<BRANCH_ID>',  -- Replace with actual branch_id from branches table
    '18fa8e97-86cd-41ce-afa5-ced19edf513c',
    'purchase',
    10.00,
    100.00,
    1000.00,
    'purchase',
    gen_random_uuid(),
    NOW()
);
*/

-- ============================================================================
-- STEP 10: Verify test data was inserted
-- ============================================================================
-- After inserting test data, run this to verify:
/*
SELECT * FROM stock_movements
WHERE product_id = '18fa8e97-86cd-41ce-afa5-ced19edf513c'
  AND company_id = '5aac3c47-af92-44f4-aa7d-4ca5bd4c135b';
*/
