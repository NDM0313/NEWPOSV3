-- ============================================================================
-- FIX ALL MISSING COLUMNS
-- ============================================================================
-- This script adds all missing company_id and other required columns
-- ============================================================================

-- ============================================================================
-- STEP 1: Check and fix branches table
-- ============================================================================

DO $$
BEGIN
    -- Add company_id to branches if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'branches' AND column_name = 'company_id'
    ) THEN
        ALTER TABLE public.branches ADD COLUMN company_id UUID;
        RAISE NOTICE '✅ Added company_id to branches table';
    END IF;
    
    -- Set default company for existing branches
    UPDATE public.branches
    SET company_id = '00000000-0000-0000-0000-000000000001'::uuid
    WHERE company_id IS NULL;
    
    -- Add foreign key constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'branches_company_id_fkey'
    ) THEN
        ALTER TABLE public.branches 
        ADD CONSTRAINT branches_company_id_fkey 
        FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
        RAISE NOTICE '✅ Added foreign key for branches.company_id';
    END IF;
    
    -- Make NOT NULL
    ALTER TABLE public.branches ALTER COLUMN company_id SET NOT NULL;
END $$;

-- ============================================================================
-- STEP 2: Check and fix users table (full_name column)
-- ============================================================================

DO $$
BEGIN
    -- Add full_name if missing (might be called 'name')
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'full_name'
    ) THEN
        -- Check if 'name' column exists
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'name'
        ) THEN
            -- Rename 'name' to 'full_name'
            ALTER TABLE public.users RENAME COLUMN name TO full_name;
            RAISE NOTICE '✅ Renamed name to full_name in users table';
        ELSE
            -- Add full_name column
            ALTER TABLE public.users ADD COLUMN full_name TEXT;
            UPDATE public.users SET full_name = email WHERE full_name IS NULL;
            ALTER TABLE public.users ALTER COLUMN full_name SET NOT NULL;
            RAISE NOTICE '✅ Added full_name to users table';
        END IF;
    END IF;
END $$;

-- ============================================================================
-- STEP 3: Check and fix contacts table
-- ============================================================================

DO $$
BEGIN
    -- Add company_id to contacts if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'company_id'
    ) THEN
        ALTER TABLE public.contacts ADD COLUMN company_id UUID;
        RAISE NOTICE '✅ Added company_id to contacts table';
    END IF;
    
    -- Set default company for existing contacts
    UPDATE public.contacts
    SET company_id = '00000000-0000-0000-0000-000000000001'::uuid
    WHERE company_id IS NULL;
    
    -- Add foreign key constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'contacts_company_id_fkey'
    ) THEN
        ALTER TABLE public.contacts 
        ADD CONSTRAINT contacts_company_id_fkey 
        FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
        RAISE NOTICE '✅ Added foreign key for contacts.company_id';
    END IF;
    
    -- Make NOT NULL
    ALTER TABLE public.contacts ALTER COLUMN company_id SET NOT NULL;
END $$;

-- ============================================================================
-- STEP 4: Check and fix products table
-- ============================================================================

DO $$
BEGIN
    -- Add company_id to products if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'company_id'
    ) THEN
        ALTER TABLE public.products ADD COLUMN company_id UUID;
        RAISE NOTICE '✅ Added company_id to products table';
    END IF;
    
    -- Set default company for existing products
    UPDATE public.products
    SET company_id = '00000000-0000-0000-0000-000000000001'::uuid
    WHERE company_id IS NULL;
    
    -- Add foreign key constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'products_company_id_fkey'
    ) THEN
        ALTER TABLE public.products 
        ADD CONSTRAINT products_company_id_fkey 
        FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
        RAISE NOTICE '✅ Added foreign key for products.company_id';
    END IF;
    
    -- Make NOT NULL
    ALTER TABLE public.products ALTER COLUMN company_id SET NOT NULL;
END $$;

-- ============================================================================
-- STEP 5: Check and fix product_categories table
-- ============================================================================

DO $$
BEGIN
    -- Add company_id to product_categories if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'product_categories' AND column_name = 'company_id'
    ) THEN
        ALTER TABLE public.product_categories ADD COLUMN company_id UUID;
        RAISE NOTICE '✅ Added company_id to product_categories table';
    END IF;
    
    -- Set default company for existing categories
    UPDATE public.product_categories
    SET company_id = '00000000-0000-0000-0000-000000000001'::uuid
    WHERE company_id IS NULL;
    
    -- Add foreign key constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'product_categories_company_id_fkey'
    ) THEN
        ALTER TABLE public.product_categories 
        ADD CONSTRAINT product_categories_company_id_fkey 
        FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
        RAISE NOTICE '✅ Added foreign key for product_categories.company_id';
    END IF;
    
    -- Make NOT NULL
    ALTER TABLE public.product_categories ALTER COLUMN company_id SET NOT NULL;
END $$;

-- ============================================================================
-- STEP 6: Verification
-- ============================================================================

SELECT 
    'VERIFICATION' as check_type,
    'branches.company_id' as column_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'branches' AND column_name = 'company_id'
    ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
UNION ALL
SELECT 'VERIFICATION', 'users.full_name', 
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'full_name'
    ) THEN '✅ EXISTS' ELSE '❌ MISSING' END
UNION ALL
SELECT 'VERIFICATION', 'contacts.company_id',
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'company_id'
    ) THEN '✅ EXISTS' ELSE '❌ MISSING' END
UNION ALL
SELECT 'VERIFICATION', 'products.company_id',
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'company_id'
    ) THEN '✅ EXISTS' ELSE '❌ MISSING' END
UNION ALL
SELECT 'VERIFICATION', 'product_categories.company_id',
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'product_categories' AND column_name = 'company_id'
    ) THEN '✅ EXISTS' ELSE '❌ MISSING' END;
