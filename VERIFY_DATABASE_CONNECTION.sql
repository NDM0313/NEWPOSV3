-- ============================================================================
-- VERIFY DATABASE CONNECTION & SCHEMA
-- ============================================================================
-- Run this FIRST to verify database is accessible and schema exists
-- ============================================================================

-- Test 1: Verify connection
SELECT 
    '✅ CONNECTION' as test,
    current_database() as database_name,
    current_user as current_user,
    version() as postgres_version;

-- Test 2: Check if critical tables exist
SELECT 
    'TABLE CHECK' as test_type,
    table_name,
    CASE 
        WHEN table_name IN (
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ) THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END as status
FROM (VALUES 
    ('companies'),
    ('branches'),
    ('users'),
    ('contacts'),
    ('products'),
    ('product_categories'),
    ('sales'),
    ('purchases'),
    ('expenses')
) AS t(table_name);

-- Test 3: Check users table structure
SELECT 
    'USERS TABLE COLUMNS' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
ORDER BY ordinal_position;

-- Test 4: Check if company_id exists in users table
SELECT 
    'COMPANY_ID CHECK' as test,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'users' 
            AND column_name = 'company_id'
        ) THEN '✅ company_id EXISTS'
        ELSE '❌ company_id MISSING - RUN fix-users-table-schema.sql'
    END as status;

-- Test 5: Check current data counts
SELECT 
    'DATA COUNT' as check_type,
    'companies' as table_name,
    COUNT(*) as record_count
FROM public.companies
UNION ALL
SELECT 'DATA COUNT', 'branches', COUNT(*) FROM public.branches
UNION ALL
SELECT 'DATA COUNT', 'users', COUNT(*) FROM public.users
UNION ALL
SELECT 'DATA COUNT', 'contacts', COUNT(*) FROM public.contacts
UNION ALL
SELECT 'DATA COUNT', 'products', COUNT(*) FROM public.products;

-- Test 6: Verify default company exists
SELECT 
    'DEFAULT COMPANY' as check_type,
    id,
    name,
    email,
    is_active,
    created_at
FROM public.companies
WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;

-- Test 7: Verify default branch exists
SELECT 
    'DEFAULT BRANCH' as check_type,
    b.id,
    b.name,
    b.code,
    c.name as company_name,
    b.is_active
FROM public.branches b
JOIN public.companies c ON b.company_id = c.id
WHERE b.id = '00000000-0000-0000-0000-000000000011'::uuid;

-- Test 8: Verify admin user exists
SELECT 
    'ADMIN USER' as check_type,
    u.id,
    u.email,
    u.full_name,
    u.role,
    c.name as company_name,
    u.is_active
FROM public.users u
JOIN public.companies c ON u.company_id = c.id
WHERE u.email = 'admin@dincollection.com';
