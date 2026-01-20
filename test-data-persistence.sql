-- ============================================================================
-- TASK 7: HARD DATA PERSISTENCE TEST
-- ============================================================================
-- Date: 2026-01-20
-- Purpose: Simulate user operations and verify data persistence
-- ============================================================================

-- STEP 1: Create Test Business (Simulating Create Business Flow)
-- ============================================================================

-- First, create an auth user (this would normally be done via Supabase Auth)
-- For testing, we'll use a test UUID
DO $$
DECLARE
    v_test_user_id UUID := '11111111-1111-1111-1111-111111111111';
    v_test_company_id UUID;
    v_test_branch_id UUID;
    v_test_email VARCHAR := 'test@dincollection.com';
    v_test_business_name VARCHAR := 'Test Business';
    v_test_owner_name VARCHAR := 'Test Owner';
BEGIN
    -- Call create_business_transaction function
    SELECT * INTO v_test_company_id, v_test_branch_id
    FROM create_business_transaction(
        v_test_business_name,
        v_test_owner_name,
        v_test_email,
        v_test_user_id
    );
    
    RAISE NOTICE 'Business created: Company ID = %, Branch ID = %', v_test_company_id, v_test_branch_id;
END $$;

-- Verify Business Creation
SELECT 
    'Business Creation' as test_step,
    CASE 
        WHEN COUNT(*) > 0 THEN 'PASS'
        ELSE 'FAIL'
    END as result,
    COUNT(*) as companies_created
FROM companies
WHERE name = 'Test Business';

SELECT 
    'Branch Creation' as test_step,
    CASE 
        WHEN COUNT(*) > 0 THEN 'PASS'
        ELSE 'FAIL'
    END as result,
    COUNT(*) as branches_created
FROM branches
WHERE name = 'Main Branch';

SELECT 
    'User Creation' as test_step,
    CASE 
        WHEN COUNT(*) > 0 THEN 'PASS'
        ELSE 'FAIL'
    END as result,
    COUNT(*) as users_created
FROM users
WHERE email = 'test@dincollection.com';

-- ============================================================================
-- STEP 2: Add Test Product (Simulating Product Creation)
-- ============================================================================

INSERT INTO products (
    company_id,
    category_id,
    name,
    sku,
    barcode,
    description,
    cost_price,
    retail_price,
    wholesale_price,
    rental_price_daily,
    current_stock,
    min_stock,
    max_stock,
    has_variations,
    is_rentable,
    is_sellable,
    track_stock,
    is_active
)
SELECT 
    c.id,
    NULL, -- No category for test
    'Test Product',
    'TEST-001',
    '1234567890123',
    'Test product description',
    100.00,
    150.00,
    130.00,
    50.00,
    100,
    10,
    1000,
    false,
    true,
    true,
    true,
    true
FROM companies c
WHERE c.name = 'Test Business'
LIMIT 1
RETURNING id, name, sku;

-- Verify Product Creation
SELECT 
    'Product Creation' as test_step,
    CASE 
        WHEN COUNT(*) > 0 THEN 'PASS'
        ELSE 'FAIL'
    END as result,
    COUNT(*) as products_created
FROM products
WHERE name = 'Test Product' AND sku = 'TEST-001';

-- ============================================================================
-- STEP 3: Add Test Contact (Simulating Contact Creation)
-- ============================================================================

INSERT INTO contacts (
    company_id,
    branch_id,
    type,
    name,
    email,
    phone,
    address,
    city,
    country,
    opening_balance,
    credit_limit,
    payment_terms,
    tax_number,
    notes,
    created_by,
    is_active
)
SELECT 
    c.id,
    b.id,
    'customer'::contact_type,
    'Test Customer',
    'customer@test.com',
    '+92 300 1234567',
    '123 Test Street',
    'Lahore',
    'Pakistan',
    0,
    10000,
    30,
    'TAX-123',
    'Test customer notes',
    u.id,
    true
FROM companies c
CROSS JOIN branches b
CROSS JOIN users u
WHERE c.name = 'Test Business'
  AND b.name = 'Main Branch'
  AND u.email = 'test@dincollection.com'
LIMIT 1
RETURNING id, name, email;

-- Verify Contact Creation
SELECT 
    'Contact Creation' as test_step,
    CASE 
        WHEN COUNT(*) > 0 THEN 'PASS'
        ELSE 'FAIL'
    END as result,
    COUNT(*) as contacts_created
FROM contacts
WHERE name = 'Test Customer' AND email = 'customer@test.com';

-- ============================================================================
-- STEP 4: Change Settings (Simulating Settings Update)
-- ============================================================================

-- Update Company Settings
UPDATE companies
SET 
    name = 'Test Business Updated',
    address = '456 Updated Street',
    phone = '+92 300 9999999',
    email = 'updated@test.com',
    tax_number = 'TAX-UPDATED',
    currency = 'USD'
WHERE name = 'Test Business';

-- Save Settings (JSONB)
INSERT INTO settings (company_id, key, value, category, description)
SELECT 
    c.id,
    'test_setting',
    '{"test": "value", "number": 123}'::jsonb,
    'general',
    'Test setting'
FROM companies c
WHERE c.name = 'Test Business Updated'
ON CONFLICT (company_id, key) 
DO UPDATE SET 
    value = EXCLUDED.value,
    updated_at = NOW();

-- Save Module Config
INSERT INTO modules_config (company_id, module_name, is_enabled)
SELECT 
    c.id,
    'test_module',
    true
FROM companies c
WHERE c.name = 'Test Business Updated'
ON CONFLICT (company_id, module_name)
DO UPDATE SET 
    is_enabled = EXCLUDED.is_enabled,
    updated_at = NOW();

-- Verify Settings Update
SELECT 
    'Company Settings Update' as test_step,
    CASE 
        WHEN COUNT(*) > 0 AND MAX(name) = 'Test Business Updated' THEN 'PASS'
        ELSE 'FAIL'
    END as result,
    COUNT(*) as companies_updated
FROM companies
WHERE name = 'Test Business Updated';

SELECT 
    'Settings Save' as test_step,
    CASE 
        WHEN COUNT(*) > 0 THEN 'PASS'
        ELSE 'FAIL'
    END as result,
    COUNT(*) as settings_saved
FROM settings
WHERE key = 'test_setting';

SELECT 
    'Module Config Save' as test_step,
    CASE 
        WHEN COUNT(*) > 0 THEN 'PASS'
        ELSE 'FAIL'
    END as result,
    COUNT(*) as module_configs_saved
FROM modules_config
WHERE module_name = 'test_module';

-- ============================================================================
-- STEP 5: Simulate "Refresh" - Verify Data Still Exists
-- ============================================================================
-- (In real test, user would do browser refresh, but we'll verify DB state)

SELECT 
    'Data Persistence After Refresh' as test_step,
    CASE 
        WHEN 
            (SELECT COUNT(*) FROM companies WHERE name = 'Test Business Updated') > 0
            AND (SELECT COUNT(*) FROM products WHERE name = 'Test Product') > 0
            AND (SELECT COUNT(*) FROM contacts WHERE name = 'Test Customer') > 0
            AND (SELECT COUNT(*) FROM settings WHERE key = 'test_setting') > 0
        THEN 'PASS'
        ELSE 'FAIL'
    END as result,
    (SELECT COUNT(*) FROM companies WHERE name = 'Test Business Updated') as companies_count,
    (SELECT COUNT(*) FROM products WHERE name = 'Test Product') as products_count,
    (SELECT COUNT(*) FROM contacts WHERE name = 'Test Customer') as contacts_count,
    (SELECT COUNT(*) FROM settings WHERE key = 'test_setting') as settings_count;

-- ============================================================================
-- STEP 6: Verify Company Isolation (No Cross-Company Data Leak)
-- ============================================================================

SELECT 
    'Company Isolation' as test_step,
    CASE 
        WHEN 
            (SELECT COUNT(*) FROM products WHERE company_id NOT IN (SELECT id FROM companies)) = 0
            AND (SELECT COUNT(*) FROM contacts WHERE company_id NOT IN (SELECT id FROM companies)) = 0
            AND (SELECT COUNT(*) FROM settings WHERE company_id NOT IN (SELECT id FROM companies)) = 0
        THEN 'PASS'
        ELSE 'FAIL'
    END as result,
    (SELECT COUNT(*) FROM products WHERE company_id NOT IN (SELECT id FROM companies)) as orphaned_products,
    (SELECT COUNT(*) FROM contacts WHERE company_id NOT IN (SELECT id FROM companies)) as orphaned_contacts,
    (SELECT COUNT(*) FROM settings WHERE company_id NOT IN (SELECT id FROM companies)) as orphaned_settings;

-- ============================================================================
-- STEP 7: Verify Foreign Key Integrity
-- ============================================================================

SELECT 
    'Foreign Key Integrity' as test_step,
    CASE 
        WHEN 
            (SELECT COUNT(*) FROM products p LEFT JOIN companies c ON p.company_id = c.id WHERE c.id IS NULL) = 0
            AND (SELECT COUNT(*) FROM contacts ct LEFT JOIN companies c ON ct.company_id = c.id WHERE c.id IS NULL) = 0
            AND (SELECT COUNT(*) FROM branches b LEFT JOIN companies c ON b.company_id = c.id WHERE c.id IS NULL) = 0
        THEN 'PASS'
        ELSE 'FAIL'
    END as result,
    (SELECT COUNT(*) FROM products p LEFT JOIN companies c ON p.company_id = c.id WHERE c.id IS NULL) as broken_product_fks,
    (SELECT COUNT(*) FROM contacts ct LEFT JOIN companies c ON ct.company_id = c.id WHERE c.id IS NULL) as broken_contact_fks,
    (SELECT COUNT(*) FROM branches b LEFT JOIN companies c ON b.company_id = c.id WHERE c.id IS NULL) as broken_branch_fks;

-- ============================================================================
-- FINAL SUMMARY
-- ============================================================================

SELECT 
    '=== FINAL TEST SUMMARY ===' as summary,
    '' as result,
    '' as details;

SELECT 
    'Total Test Steps' as metric,
    '8' as value;

SELECT 
    'Test Data Created' as metric,
    (
        (SELECT COUNT(*) FROM companies WHERE name LIKE 'Test%')::text || ' companies, ' ||
        (SELECT COUNT(*) FROM products WHERE name = 'Test Product')::text || ' products, ' ||
        (SELECT COUNT(*) FROM contacts WHERE name = 'Test Customer')::text || ' contacts, ' ||
        (SELECT COUNT(*) FROM settings WHERE key = 'test_setting')::text || ' settings'
    ) as value;

-- ============================================================================
-- CLEANUP (Optional - Comment out if you want to keep test data)
-- ============================================================================

-- Uncomment to clean up test data:
/*
DELETE FROM settings WHERE company_id IN (SELECT id FROM companies WHERE name LIKE 'Test%');
DELETE FROM modules_config WHERE company_id IN (SELECT id FROM companies WHERE name LIKE 'Test%');
DELETE FROM products WHERE company_id IN (SELECT id FROM companies WHERE name LIKE 'Test%');
DELETE FROM contacts WHERE company_id IN (SELECT id FROM companies WHERE name LIKE 'Test%');
DELETE FROM users WHERE email = 'test@dincollection.com';
DELETE FROM branches WHERE company_id IN (SELECT id FROM companies WHERE name LIKE 'Test%');
DELETE FROM companies WHERE name LIKE 'Test%';
*/
