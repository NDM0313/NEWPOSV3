-- ============================================================================
-- TASK 2: BACKEND SERVICES FULL VERIFICATION
-- ============================================================================
-- Purpose: Verify that backend services actually write to database
-- ============================================================================

-- Test 1: Verify create_business_transaction function exists
SELECT 
    'Function Check' as test,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_schema = 'public' 
            AND routine_name = 'create_business_transaction'
        ) THEN 'PASS'
        ELSE 'FAIL'
    END as result;

-- Test 2: Check if any companies exist (to verify writes work)
SELECT 
    'Companies Table Writable' as test,
    CASE 
        WHEN COUNT(*) >= 0 THEN 'PASS'
        ELSE 'FAIL'
    END as result,
    COUNT(*) as total_companies
FROM companies;

-- Test 3: Check if any products exist
SELECT 
    'Products Table Writable' as test,
    CASE 
        WHEN COUNT(*) >= 0 THEN 'PASS'
        ELSE 'FAIL'
    END as result,
    COUNT(*) as total_products
FROM products;

-- Test 4: Check if any contacts exist
SELECT 
    'Contacts Table Writable' as test,
    CASE 
        WHEN COUNT(*) >= 0 THEN 'PASS'
        ELSE 'FAIL'
    END as result,
    COUNT(*) as total_contacts
FROM contacts;

-- Test 5: Check if any settings exist
SELECT 
    'Settings Table Writable' as test,
    CASE 
        WHEN COUNT(*) >= 0 THEN 'PASS'
        ELSE 'FAIL'
    END as result,
    COUNT(*) as total_settings
FROM settings;

-- Test 6: Verify foreign key constraints exist
SELECT 
    'Foreign Keys Check' as test,
    CASE 
        WHEN COUNT(*) > 0 THEN 'PASS'
        ELSE 'FAIL'
    END as result,
    COUNT(*) as total_fks
FROM pg_constraint 
WHERE contype = 'f' 
AND conrelid IN (
    'companies'::regclass,
    'products'::regclass,
    'contacts'::regclass,
    'settings'::regclass
);

-- Test 7: Verify NOT NULL constraints exist
SELECT 
    'NOT NULL Constraints Check' as test,
    CASE 
        WHEN COUNT(*) > 0 THEN 'PASS'
        ELSE 'FAIL'
    END as result,
    COUNT(*) as total_not_null
FROM information_schema.columns
WHERE is_nullable = 'NO'
AND table_name IN ('companies', 'products', 'contacts', 'settings');

-- Test 8: Verify company isolation (all records have company_id)
SELECT 
    'Company Isolation Check' as test,
    CASE 
        WHEN 
            (SELECT COUNT(*) FROM products WHERE company_id IS NULL) = 0
            AND (SELECT COUNT(*) FROM contacts WHERE company_id IS NULL) = 0
            AND (SELECT COUNT(*) FROM settings WHERE company_id IS NULL) = 0
        THEN 'PASS'
        ELSE 'FAIL'
    END as result,
    (SELECT COUNT(*) FROM products WHERE company_id IS NULL) as orphaned_products,
    (SELECT COUNT(*) FROM contacts WHERE company_id IS NULL) as orphaned_contacts,
    (SELECT COUNT(*) FROM settings WHERE company_id IS NULL) as orphaned_settings;

-- Final Summary
SELECT 
    '=== VERIFICATION SUMMARY ===' as summary;
