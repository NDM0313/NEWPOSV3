-- ============================================================================
-- COMPLETE DATABASE ANALYSIS & FIX SCRIPT
-- ============================================================================
-- This script analyzes and fixes all database issues for functional demo

-- ============================================================================
-- STEP 1: CHECK TABLE STRUCTURE
-- ============================================================================

-- Check if users table has company_id
SELECT 
  'users.company_id' as check_item,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'company_id'
    ) THEN '✅ EXISTS'
    ELSE '❌ MISSING - WILL ADD'
  END as status;

-- Check all critical tables exist
SELECT 
  'Table Exists' as check_type,
  table_name,
  CASE 
    WHEN table_name IN (
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ) THEN '✅'
    ELSE '❌'
  END as status
FROM (VALUES 
  ('companies'), ('branches'), ('users'), ('contacts'), 
  ('products'), ('sales'), ('purchases'), ('expenses')
) AS t(table_name);

-- ============================================================================
-- STEP 2: FIX USERS TABLE
-- ============================================================================

-- Add company_id if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE public.users ADD COLUMN company_id UUID;
    RAISE NOTICE '✅ Added company_id column to users';
  END IF;
END $$;

-- Set default company for existing users
UPDATE public.users
SET company_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE company_id IS NULL;

-- Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'users_company_id_fkey'
  ) THEN
    ALTER TABLE public.users 
    ADD CONSTRAINT users_company_id_fkey 
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
    RAISE NOTICE '✅ Added foreign key constraint';
  END IF;
END $$;

-- Make NOT NULL
ALTER TABLE public.users ALTER COLUMN company_id SET NOT NULL;

-- ============================================================================
-- STEP 3: ENSURE DEFAULT COMPANY EXISTS
-- ============================================================================

INSERT INTO companies (id, name, email, phone, address, city, state, country, currency, is_active)
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
  is_active = true;

-- ============================================================================
-- STEP 4: ENSURE DEFAULT BRANCH EXISTS
-- ============================================================================

INSERT INTO branches (id, company_id, name, code, phone, address, city, is_active)
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
  is_active = true;

-- ============================================================================
-- STEP 5: VERIFY RLS POLICIES
-- ============================================================================

-- Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('users', 'products', 'sales', 'contacts', 'branches')
ORDER BY tablename;

-- Check policies for INSERT/UPDATE/DELETE
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd as command,
  roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('users', 'products', 'sales', 'contacts', 'branches')
  AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
ORDER BY tablename, cmd;

-- ============================================================================
-- STEP 6: DATA COUNTS
-- ============================================================================

SELECT 
  'companies' as table_name, COUNT(*) as record_count FROM companies
UNION ALL
SELECT 'branches', COUNT(*) FROM branches
UNION ALL
SELECT 'users', COUNT(*) FROM users
UNION ALL
SELECT 'contacts', COUNT(*) FROM contacts
UNION ALL
SELECT 'products', COUNT(*) FROM products
UNION ALL
SELECT 'sales', COUNT(*) FROM sales
UNION ALL
SELECT 'purchases', COUNT(*) FROM purchases
UNION ALL
SELECT 'expenses', COUNT(*) FROM expenses;

-- ============================================================================
-- STEP 7: VERIFY USER HAS COMPANY_ID
-- ============================================================================

SELECT 
  u.id,
  u.email,
  u.full_name,
  u.role,
  u.company_id,
  c.name as company_name,
  CASE 
    WHEN u.company_id IS NOT NULL THEN '✅'
    ELSE '❌ MISSING'
  END as status
FROM users u
LEFT JOIN companies c ON u.company_id = c.id
WHERE u.email = 'admin@dincollection.com';
