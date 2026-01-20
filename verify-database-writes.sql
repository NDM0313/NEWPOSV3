-- ============================================================================
-- DATABASE WRITE VERIFICATION QUERIES
-- ============================================================================
-- Date: 2026-01-20
-- Purpose: Verify that data is actually being written to database
-- ============================================================================

-- 1. Verify create_business_transaction function exists
SELECT 
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name = 'create_business_transaction';

-- 2. Check recent companies (last 24 hours)
SELECT 
    id,
    name,
    email,
    is_active,
    is_demo,
    created_at
FROM companies
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 10;

-- 3. Check recent branches
SELECT 
    id,
    company_id,
    name,
    code,
    is_default,
    created_at
FROM branches
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 10;

-- 4. Check recent users
SELECT 
    id,
    company_id,
    email,
    full_name,
    role,
    is_active,
    created_at
FROM users
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 10;

-- 5. Check recent products
SELECT 
    id,
    company_id,
    name,
    sku,
    retail_price,
    current_stock,
    is_active,
    created_at
FROM products
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 10;

-- 6. Check recent contacts
SELECT 
    id,
    company_id,
    name,
    type,
    email,
    phone,
    is_active,
    created_at
FROM contacts
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 10;

-- 7. Check recent settings
SELECT 
    id,
    company_id,
    key,
    category,
    updated_at
FROM settings
WHERE updated_at >= NOW() - INTERVAL '24 hours'
ORDER BY updated_at DESC
LIMIT 10;

-- 8. Verify company_id isolation (check for cross-company data)
SELECT 
    'products' as table_name,
    COUNT(DISTINCT company_id) as unique_companies,
    COUNT(*) as total_records
FROM products
UNION ALL
SELECT 
    'contacts' as table_name,
    COUNT(DISTINCT company_id) as unique_companies,
    COUNT(*) as total_records
FROM contacts
UNION ALL
SELECT 
    'sales' as table_name,
    COUNT(DISTINCT company_id) as unique_companies,
    COUNT(*) as total_records
FROM sales
UNION ALL
SELECT 
    'purchases' as table_name,
    COUNT(DISTINCT company_id) as unique_companies,
    COUNT(*) as total_records
FROM purchases;

-- 9. Check for NULL company_id (should be zero)
SELECT 
    'products' as table_name,
    COUNT(*) as null_company_id_count
FROM products
WHERE company_id IS NULL
UNION ALL
SELECT 
    'contacts' as table_name,
    COUNT(*) as null_company_id_count
FROM contacts
WHERE company_id IS NULL
UNION ALL
SELECT 
    'sales' as table_name,
    COUNT(*) as null_company_id_count
FROM sales
WHERE company_id IS NULL
UNION ALL
SELECT 
    'purchases' as table_name,
    COUNT(*) as null_company_id_count
FROM purchases
WHERE company_id IS NULL;

-- 10. Verify foreign key constraints
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('products', 'contacts', 'sales', 'purchases', 'expenses')
ORDER BY tc.table_name, kcu.column_name;
