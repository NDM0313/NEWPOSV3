-- ============================================================================
-- FRESH DEMO SETUP - ZERO TO FUNCTIONAL
-- ============================================================================
-- This script creates a complete fresh demo environment from scratch
-- All data will be inserted into the provided Supabase database
-- Connection: postgresql://postgres.pcxfwmbcjrkgzibgdrlz:khan313ndm313@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres
-- ============================================================================

-- ============================================================================
-- STEP 1: CLEAN SLATE (Optional - Comment out if you want to keep existing data)
-- ============================================================================
-- WARNING: This will delete all existing demo data
-- Uncomment only if you want a completely fresh start

/*
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Delete in reverse order of dependencies
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename) LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END $$;
*/

-- ============================================================================
-- STEP 2: ENSURE BASE TABLES EXIST (If not already created)
-- ============================================================================

-- Companies table (if not exists)
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    country TEXT DEFAULT 'Pakistan',
    currency TEXT DEFAULT 'PKR',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Branches table (if not exists)
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table (if not exists) - WITH company_id
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    phone TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add company_id column if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'company_id'
    ) THEN
        ALTER TABLE public.users ADD COLUMN company_id UUID;
        UPDATE public.users SET company_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE company_id IS NULL;
        ALTER TABLE public.users ALTER COLUMN company_id SET NOT NULL;
        ALTER TABLE public.users ADD CONSTRAINT users_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
    END IF;
END $$;

-- ============================================================================
-- STEP 3: CREATE FRESH DEMO COMPANY
-- ============================================================================

INSERT INTO public.companies (id, name, email, phone, address, city, state, country, currency, is_active)
VALUES (
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Din Collection',
    'info@dincollection.com',
    '+92-300-1234567',
    '123 Main Street, Saddar',
    'Karachi',
    'Sindh',
    'Pakistan',
    'PKR',
    true
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    is_active = true;

-- ============================================================================
-- STEP 4: CREATE FRESH DEMO BRANCH
-- ============================================================================

INSERT INTO public.branches (id, company_id, name, code, phone, address, city, state, is_active)
VALUES (
    '00000000-0000-0000-0000-000000000011'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Main Branch (HQ)',
    'HQ',
    '+92-300-1234567',
    '123 Main Street, Saddar',
    'Karachi',
    true
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    company_id = EXCLUDED.company_id,
    is_active = true;

-- ============================================================================
-- STEP 5: CREATE FRESH DEMO ADMIN USER
-- ============================================================================
-- Note: This assumes the user already exists in auth.users
-- If not, create it first in Supabase Dashboard → Authentication → Users

INSERT INTO public.users (id, company_id, email, full_name, role, phone, is_active)
VALUES (
    (SELECT id FROM auth.users WHERE email = 'admin@dincollection.com' LIMIT 1),
    '00000000-0000-0000-0000-000000000001'::uuid,
    'admin@dincollection.com',
    'Admin User',
    'admin',
    '+92-300-1234567',
    true
)
ON CONFLICT (id) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    is_active = true;

-- If auth user doesn't exist, create a placeholder (will need to be linked later)
DO $$
DECLARE
    auth_user_exists BOOLEAN;
    demo_user_id UUID;
BEGIN
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = 'admin@dincollection.com') INTO auth_user_exists;
    
    IF NOT auth_user_exists THEN
        -- Generate a UUID for the user
        demo_user_id := gen_random_uuid();
        
        -- Insert into public.users (will need to link to auth.users later)
        INSERT INTO public.users (id, company_id, email, full_name, role, phone, is_active)
        VALUES (
            demo_user_id,
            '00000000-0000-0000-0000-000000000001'::uuid,
            'admin@dincollection.com',
            'Admin User',
            'admin',
            '+92-300-1234567',
            true
        )
        ON CONFLICT (id) DO UPDATE SET
            company_id = EXCLUDED.company_id,
            email = EXCLUDED.email,
            full_name = EXCLUDED.full_name,
            role = EXCLUDED.role,
            is_active = true;
            
        RAISE NOTICE '⚠️ Created placeholder user. Please create user in Supabase Auth Dashboard and link the ID.';
    END IF;
END $$;

-- ============================================================================
-- STEP 6: VERIFICATION QUERIES
-- ============================================================================

-- Verify Company
SELECT 
    '✅ COMPANY' as check_type,
    id,
    name,
    email,
    is_active,
    created_at
FROM public.companies
WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;

-- Verify Branch
SELECT 
    '✅ BRANCH' as check_type,
    b.id,
    b.name,
    b.code,
    c.name as company_name,
    b.is_active
FROM public.branches b
JOIN public.companies c ON b.company_id = c.id
WHERE b.id = '00000000-0000-0000-0000-000000000011'::uuid;

-- Verify User
SELECT 
    '✅ USER' as check_type,
    u.id,
    u.email,
    u.full_name,
    u.role,
    c.name as company_name,
    u.is_active
FROM public.users u
JOIN public.companies c ON u.company_id = c.id
WHERE u.email = 'admin@dincollection.com';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ FRESH DEMO SETUP COMPLETE!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Company: Din Collection';
    RAISE NOTICE 'Branch: Main Branch (HQ)';
    RAISE NOTICE 'User: admin@dincollection.com';
    RAISE NOTICE '';
    RAISE NOTICE 'Next: Test data insertion from frontend';
    RAISE NOTICE '========================================';
END $$;
