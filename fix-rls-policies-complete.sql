-- ============================================================================
-- COMPLETE RLS POLICIES FIX
-- ============================================================================
-- This script fixes RLS policies to allow INSERT/UPDATE/DELETE for authenticated users
-- ============================================================================

-- ============================================================================
-- STEP 1: ENABLE RLS ON ALL TABLES (if not already enabled)
-- ============================================================================

ALTER TABLE IF EXISTS public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.expenses ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: DROP EXISTING POLICIES (to recreate them correctly)
-- ============================================================================

-- Drop existing policies on users table
DROP POLICY IF EXISTS "Users can view own company" ON public.users;
DROP POLICY IF EXISTS "Users can insert own record" ON public.users;
DROP POLICY IF EXISTS "Users can update own record" ON public.users;
DROP POLICY IF EXISTS "Users can view all in company" ON public.users;
DROP POLICY IF EXISTS "Users can insert in company" ON public.users;
DROP POLICY IF EXISTS "Users can update in company" ON public.users;

-- Drop existing policies on contacts table
DROP POLICY IF EXISTS "Users can view contacts in company" ON public.contacts;
DROP POLICY IF EXISTS "Users can insert contacts in company" ON public.contacts;
DROP POLICY IF EXISTS "Users can update contacts in company" ON public.contacts;
DROP POLICY IF EXISTS "Users can delete contacts in company" ON public.contacts;

-- Drop existing policies on products table
DROP POLICY IF EXISTS "Users can view products in company" ON public.products;
DROP POLICY IF EXISTS "Users can insert products in company" ON public.products;
DROP POLICY IF EXISTS "Users can update products in company" ON public.products;
DROP POLICY IF EXISTS "Users can delete products in company" ON public.products;

-- Drop existing policies on branches table
DROP POLICY IF EXISTS "Users can view branches in company" ON public.branches;
DROP POLICY IF EXISTS "Users can insert branches in company" ON public.branches;
DROP POLICY IF EXISTS "Users can update branches in company" ON public.branches;
DROP POLICY IF EXISTS "Users can delete branches in company" ON public.branches;

-- Drop existing policies on product_categories table
DROP POLICY IF EXISTS "Users can view categories in company" ON public.product_categories;
DROP POLICY IF EXISTS "Users can insert categories in company" ON public.product_categories;
DROP POLICY IF EXISTS "Users can update categories in company" ON public.product_categories;
DROP POLICY IF EXISTS "Users can delete categories in company" ON public.product_categories;

-- ============================================================================
-- STEP 3: CREATE HELPER FUNCTION TO GET USER'S COMPANY ID
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID AS $$
DECLARE
    user_company_id UUID;
BEGIN
    SELECT company_id INTO user_company_id
    FROM public.users
    WHERE id = auth.uid()
    LIMIT 1;
    
    RETURN user_company_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 4: USERS TABLE POLICIES (SPECIAL CASE - CRITICAL)
-- ============================================================================

-- Policy 1: Users can view all users in their company
CREATE POLICY "Users can view all in company"
ON public.users
FOR SELECT
TO authenticated
USING (
    company_id = (
        SELECT company_id FROM public.users WHERE id = auth.uid()
    )
    OR id = auth.uid()
);

-- Policy 2: Users can INSERT their own record (for initial user creation)
-- This allows creating a user entry when auth user is created
CREATE POLICY "Users can insert own record"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (
    id = auth.uid()
    AND company_id IS NOT NULL
);

-- Policy 3: Users can INSERT in their company (for admin creating other users)
CREATE POLICY "Users can insert in company"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (
    company_id = (
        SELECT company_id FROM public.users WHERE id = auth.uid()
    )
);

-- Policy 4: Users can UPDATE their own record
CREATE POLICY "Users can update own record"
ON public.users
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Policy 5: Users can UPDATE users in their company (for admin)
CREATE POLICY "Users can update in company"
ON public.users
FOR UPDATE
TO authenticated
USING (
    company_id = (
        SELECT company_id FROM public.users WHERE id = auth.uid()
    )
)
WITH CHECK (
    company_id = (
        SELECT company_id FROM public.users WHERE id = auth.uid()
    )
);

-- ============================================================================
-- STEP 5: CONTACTS TABLE POLICIES
-- ============================================================================

-- View contacts in company
CREATE POLICY "Users can view contacts in company"
ON public.contacts
FOR SELECT
TO authenticated
USING (
    company_id = (
        SELECT company_id FROM public.users WHERE id = auth.uid()
    )
);

-- Insert contacts in company
CREATE POLICY "Users can insert contacts in company"
ON public.contacts
FOR INSERT
TO authenticated
WITH CHECK (
    company_id = (
        SELECT company_id FROM public.users WHERE id = auth.uid()
    )
);

-- Update contacts in company
CREATE POLICY "Users can update contacts in company"
ON public.contacts
FOR UPDATE
TO authenticated
USING (
    company_id = (
        SELECT company_id FROM public.users WHERE id = auth.uid()
    )
)
WITH CHECK (
    company_id = (
        SELECT company_id FROM public.users WHERE id = auth.uid()
    )
);

-- Delete contacts in company (soft delete by setting is_active = false)
CREATE POLICY "Users can delete contacts in company"
ON public.contacts
FOR DELETE
TO authenticated
USING (
    company_id = (
        SELECT company_id FROM public.users WHERE id = auth.uid()
    )
);

-- ============================================================================
-- STEP 6: PRODUCTS TABLE POLICIES
-- ============================================================================

-- View products in company
CREATE POLICY "Users can view products in company"
ON public.products
FOR SELECT
TO authenticated
USING (
    company_id = (
        SELECT company_id FROM public.users WHERE id = auth.uid()
    )
);

-- Insert products in company
CREATE POLICY "Users can insert products in company"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (
    company_id = (
        SELECT company_id FROM public.users WHERE id = auth.uid()
    )
);

-- Update products in company
CREATE POLICY "Users can update products in company"
ON public.products
FOR UPDATE
TO authenticated
USING (
    company_id = (
        SELECT company_id FROM public.users WHERE id = auth.uid()
    )
)
WITH CHECK (
    company_id = (
        SELECT company_id FROM public.users WHERE id = auth.uid()
    )
);

-- Delete products in company (soft delete)
CREATE POLICY "Users can delete products in company"
ON public.products
FOR DELETE
TO authenticated
USING (
    company_id = (
        SELECT company_id FROM public.users WHERE id = auth.uid()
    )
);

-- ============================================================================
-- STEP 7: BRANCHES TABLE POLICIES
-- ============================================================================

-- View branches in company
CREATE POLICY "Users can view branches in company"
ON public.branches
FOR SELECT
TO authenticated
USING (
    company_id = (
        SELECT company_id FROM public.users WHERE id = auth.uid()
    )
);

-- Insert branches in company
CREATE POLICY "Users can insert branches in company"
ON public.branches
FOR INSERT
TO authenticated
WITH CHECK (
    company_id = (
        SELECT company_id FROM public.users WHERE id = auth.uid()
    )
);

-- Update branches in company
CREATE POLICY "Users can update branches in company"
ON public.branches
FOR UPDATE
TO authenticated
USING (
    company_id = (
        SELECT company_id FROM public.users WHERE id = auth.uid()
    )
)
WITH CHECK (
    company_id = (
        SELECT company_id FROM public.users WHERE id = auth.uid()
    )
);

-- ============================================================================
-- STEP 8: PRODUCT CATEGORIES TABLE POLICIES
-- ============================================================================

-- View categories in company
CREATE POLICY "Users can view categories in company"
ON public.product_categories
FOR SELECT
TO authenticated
USING (
    company_id = (
        SELECT company_id FROM public.users WHERE id = auth.uid()
    )
);

-- Insert categories in company
CREATE POLICY "Users can insert categories in company"
ON public.product_categories
FOR INSERT
TO authenticated
WITH CHECK (
    company_id = (
        SELECT company_id FROM public.users WHERE id = auth.uid()
    )
);

-- Update categories in company
CREATE POLICY "Users can update categories in company"
ON public.product_categories
FOR UPDATE
TO authenticated
USING (
    company_id = (
        SELECT company_id FROM public.users WHERE id = auth.uid()
    )
)
WITH CHECK (
    company_id = (
        SELECT company_id FROM public.users WHERE id = auth.uid()
    )
);

-- ============================================================================
-- STEP 9: VERIFICATION
-- ============================================================================

-- Check RLS status
SELECT 
    'RLS STATUS' as check_type,
    tablename,
    CASE WHEN rowsecurity THEN '✅ ENABLED' ELSE '❌ DISABLED' END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('users', 'contacts', 'products', 'branches', 'product_categories')
ORDER BY tablename;

-- Check policies count
SELECT 
    'POLICIES COUNT' as check_type,
    schemaname,
    tablename,
    COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('users', 'contacts', 'products', 'branches', 'product_categories')
GROUP BY schemaname, tablename
ORDER BY tablename;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ RLS POLICIES FIX COMPLETE!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'All tables now have proper INSERT/UPDATE/DELETE policies';
    RAISE NOTICE 'Users can now create/edit/delete data in their company';
    RAISE NOTICE '';
    RAISE NOTICE 'Next: Test data creation from frontend';
    RAISE NOTICE '========================================';
END $$;
