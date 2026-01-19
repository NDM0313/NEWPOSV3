-- ============================================================================
-- ADD MISSING SCHEMA COLUMNS
-- ============================================================================
-- This script adds missing columns to match the expected schema
-- ============================================================================

-- ============================================================================
-- BRANCHES TABLE
-- ============================================================================

DO $$
BEGIN
    -- Add city if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'branches' AND column_name = 'city'
    ) THEN
        ALTER TABLE public.branches ADD COLUMN city VARCHAR(100);
        RAISE NOTICE '✅ Added city to branches table';
    END IF;
    
    -- Add state if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'branches' AND column_name = 'state'
    ) THEN
        ALTER TABLE public.branches ADD COLUMN state VARCHAR(100);
        RAISE NOTICE '✅ Added state to branches table';
    END IF;
END $$;

-- ============================================================================
-- USERS TABLE
-- ============================================================================

DO $$
BEGIN
    -- Add phone if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'phone'
    ) THEN
        ALTER TABLE public.users ADD COLUMN phone VARCHAR(50);
        RAISE NOTICE '✅ Added phone to users table';
    END IF;
END $$;

-- ============================================================================
-- CONTACTS TABLE
-- ============================================================================

DO $$
BEGIN
    -- Add city if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'city'
    ) THEN
        ALTER TABLE public.contacts ADD COLUMN city VARCHAR(100);
        RAISE NOTICE '✅ Added city to contacts table';
    END IF;
    
    -- Add state if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'state'
    ) THEN
        ALTER TABLE public.contacts ADD COLUMN state VARCHAR(100);
        RAISE NOTICE '✅ Added state to contacts table';
    END IF;
END $$;

-- ============================================================================
-- PRODUCTS TABLE
-- ============================================================================

DO $$
BEGIN
    -- Add category_id if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'category_id'
    ) THEN
        ALTER TABLE public.products ADD COLUMN category_id UUID;
        -- Add foreign key if product_categories table exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_categories') THEN
            ALTER TABLE public.products 
            ADD CONSTRAINT products_category_id_fkey 
            FOREIGN KEY (category_id) REFERENCES public.product_categories(id) ON DELETE SET NULL;
        END IF;
        RAISE NOTICE '✅ Added category_id to products table';
    END IF;
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 
    'VERIFICATION' as check_type,
    'branches.city' as column_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'branches' AND column_name = 'city'
    ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
UNION ALL
SELECT 'VERIFICATION', 'users.phone',
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'phone'
    ) THEN '✅ EXISTS' ELSE '❌ MISSING' END
UNION ALL
SELECT 'VERIFICATION', 'contacts.city',
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'city'
    ) THEN '✅ EXISTS' ELSE '❌ MISSING' END
UNION ALL
SELECT 'VERIFICATION', 'products.category_id',
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'category_id'
    ) THEN '✅ EXISTS' ELSE '❌ MISSING' END;
