-- ============================================================================
-- INSERT TEST STOCK MOVEMENT DATA
-- ============================================================================
-- ⚠️ ONLY RUN THIS IF stock_movements TABLE IS EMPTY
-- ⚠️ This is for testing/verification purposes only
-- ============================================================================

-- STEP 1: Get valid branch_id for the company
-- ============================================================================
-- First, find a valid branch_id for company: 5aac3c47-af92-44f4-aa7d-4ca5bd4c135b
SELECT id, name, company_id 
FROM branches 
WHERE company_id = '5aac3c47-af92-44f4-aa7d-4ca5bd4c135b'
ORDER BY name
LIMIT 1;

-- STEP 2: Insert test purchase movement (IN)
-- ============================================================================
-- Replace <BRANCH_ID> with the actual branch_id from STEP 1
-- Product ID: 18fa8e97-86cd-41ce-afa5-ced19edf513c
-- Company ID: 5aac3c47-af92-44f4-aa7d-4ca5bd4c135b

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
    notes,
    created_at
) VALUES (
    gen_random_uuid(),
    '5aac3c47-af92-44f4-aa7d-4ca5bd4c135b',
    (SELECT id FROM branches WHERE company_id = '5aac3c47-af92-44f4-aa7d-4ca5bd4c135b LIMIT 1), -- Auto-select first branch
    '18fa8e97-86cd-41ce-afa5-ced19edf513c',
    'purchase',
    50.00,  -- Positive for IN
    100.00,
    5000.00,
    'purchase',
    gen_random_uuid(),
    'Test purchase movement for verification',
    NOW()
);

-- STEP 3: Insert test sale movement (OUT)
-- ============================================================================
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
    notes,
    created_at
) VALUES (
    gen_random_uuid(),
    '5aac3c47-af92-44f4-aa7d-4ca5bd4c135b',
    (SELECT id FROM branches WHERE company_id = '5aac3c47-af92-44f4-aa7d-4ca5bd4c135b LIMIT 1),
    '18fa8e97-86cd-41ce-afa5-ced19edf513c',
    'sale',
    -20.00,  -- Negative for OUT
    150.00,
    -3000.00,
    'sale',
    gen_random_uuid(),
    'Test sale movement for verification',
    NOW()
);

-- STEP 4: Insert another purchase movement
-- ============================================================================
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
    notes,
    created_at
) VALUES (
    gen_random_uuid(),
    '5aac3c47-af92-44f4-aa7d-4ca5bd4c135b',
    (SELECT id FROM branches WHERE company_id = '5aac3c47-af92-44f4-aa7d-4ca5bd4c135b LIMIT 1),
    '18fa8e97-86cd-41ce-afa5-ced19edf513c',
    'purchase',
    30.00,
    110.00,
    3300.00,
    'purchase',
    gen_random_uuid(),
    'Test purchase movement 2',
    NOW() - INTERVAL '1 day'  -- Yesterday
);

-- STEP 5: Verify inserted data
-- ============================================================================
SELECT 
    id,
    product_id,
    company_id,
    branch_id,
    movement_type,
    quantity,
    unit_cost,
    total_cost,
    reference_type,
    created_at
FROM stock_movements
WHERE product_id = '18fa8e97-86cd-41ce-afa5-ced19edf513c'
  AND company_id = '5aac3c47-af92-44f4-aa7d-4ca5bd4c135b'
ORDER BY created_at DESC;

-- Expected result:
-- 3 rows:
-- 1. Purchase: +50 (most recent)
-- 2. Sale: -20
-- 3. Purchase: +30 (yesterday)
-- Total balance should be: 50 - 20 + 30 = 60
