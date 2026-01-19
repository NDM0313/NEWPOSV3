-- ============================================================================
-- CHECK ACTUAL SCHEMA
-- ============================================================================
-- This script checks what columns actually exist in each table
-- ============================================================================

-- Check branches table columns
SELECT 
    'branches' as table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'branches'
ORDER BY ordinal_position;

-- Check users table columns
SELECT 
    'users' as table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users'
ORDER BY ordinal_position;

-- Check contacts table columns
SELECT 
    'contacts' as table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'contacts'
ORDER BY ordinal_position;

-- Check products table columns
SELECT 
    'products' as table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'products'
ORDER BY ordinal_position;
