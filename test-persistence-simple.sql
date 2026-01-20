-- ============================================================================
-- TASK 7: SIMPLIFIED PERSISTENCE TEST
-- ============================================================================
-- Direct database operations to verify persistence
-- ============================================================================

-- Test 1: Create Company Directly
INSERT INTO companies (name, email, is_active, is_demo)
VALUES ('Persistence Test Company', 'persist@test.com', true, false)
RETURNING id, name;

-- Test 2: Create Branch
INSERT INTO branches (company_id, name, code, is_active, is_default)
SELECT id, 'Test Branch', 'TB', true, true
FROM companies
WHERE name = 'Persistence Test Company'
RETURNING id, name;

-- Test 3: Create User
INSERT INTO users (id, company_id, email, full_name, role, is_active)
SELECT 
    '33333333-3333-3333-3333-333333333333'::UUID,
    id,
    'user@persist.com',
    'Test User',
    'admin',
    true
FROM companies
WHERE name = 'Persistence Test Company'
RETURNING id, email, full_name;

-- Test 4: Create Product
INSERT INTO products (
    company_id,
    name,
    sku,
    barcode,
    cost_price,
    retail_price,
    wholesale_price,
    current_stock,
    min_stock,
    max_stock,
    is_active
)
SELECT 
    id,
    'Persistence Test Product',
    'PERSIST-001',
    '9876543210987',
    50.00,
    75.00,
    65.00,
    100,
    10,
    1000,
    true
FROM companies
WHERE name = 'Persistence Test Company'
RETURNING id, name, sku;

-- Test 5: Create Contact
INSERT INTO contacts (
    company_id,
    branch_id,
    type,
    name,
    email,
    phone,
    is_active
)
SELECT 
    c.id,
    b.id,
    'customer'::contact_type,
    'Persistence Test Customer',
    'customer@persist.com',
    '+92 300 1111111',
    true
FROM companies c
CROSS JOIN branches b
WHERE c.name = 'Persistence Test Company'
  AND b.name = 'Test Branch'
RETURNING id, name, email;

-- Test 6: Save Setting
INSERT INTO settings (company_id, key, value, category)
SELECT 
    id,
    'persistence_test_setting',
    '{"test": "persistence", "value": 123}'::jsonb,
    'test'
FROM companies
WHERE name = 'Persistence Test Company'
ON CONFLICT (company_id, key)
DO UPDATE SET 
    value = EXCLUDED.value,
    updated_at = NOW()
RETURNING id, key, value;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify all data exists
SELECT 
    '=== PERSISTENCE TEST RESULTS ===' as test;

SELECT 
    'Company' as entity_type,
    COUNT(*) as count,
    CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END as result
FROM companies
WHERE name = 'Persistence Test Company';

SELECT 
    'Branch' as entity_type,
    COUNT(*) as count,
    CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END as result
FROM branches
WHERE name = 'Test Branch';

SELECT 
    'User' as entity_type,
    COUNT(*) as count,
    CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END as result
FROM users
WHERE email = 'user@persist.com';

SELECT 
    'Product' as entity_type,
    COUNT(*) as count,
    CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END as result
FROM products
WHERE name = 'Persistence Test Product';

SELECT 
    'Contact' as entity_type,
    COUNT(*) as count,
    CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END as result
FROM contacts
WHERE name = 'Persistence Test Customer';

SELECT 
    'Setting' as entity_type,
    COUNT(*) as count,
    CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END as result
FROM settings
WHERE key = 'persistence_test_setting';

-- Verify Foreign Keys
SELECT 
    'Foreign Key Check' as check_type,
    CASE 
        WHEN 
            (SELECT COUNT(*) FROM products p 
             LEFT JOIN companies c ON p.company_id = c.id 
             WHERE c.id IS NULL AND p.name = 'Persistence Test Product') = 0
            AND
            (SELECT COUNT(*) FROM contacts ct 
             LEFT JOIN companies c ON ct.company_id = c.id 
             WHERE c.id IS NULL AND ct.name = 'Persistence Test Customer') = 0
        THEN 'PASS'
        ELSE 'FAIL'
    END as result;

-- Final Summary
SELECT 
    '=== FINAL SUMMARY ===' as summary,
    (
        (SELECT COUNT(*) FROM companies WHERE name = 'Persistence Test Company')::text || ' companies, ' ||
        (SELECT COUNT(*) FROM products WHERE name = 'Persistence Test Product')::text || ' products, ' ||
        (SELECT COUNT(*) FROM contacts WHERE name = 'Persistence Test Customer')::text || ' contacts, ' ||
        (SELECT COUNT(*) FROM settings WHERE key = 'persistence_test_setting')::text || ' settings'
    ) as data_created;
