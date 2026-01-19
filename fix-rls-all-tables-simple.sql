-- ============================================================================
-- COMPLETE RLS FIX - SIMPLE POLICIES FOR DEMO/TESTING
-- ============================================================================
-- This fixes RLS policies to allow INSERT/UPDATE/DELETE without requiring permissions table
-- ============================================================================

-- ============================================================================
-- STEP 1: FIX USERS TABLE (CRITICAL)
-- ============================================================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Admins can manage users" ON public.users;
DROP POLICY IF EXISTS "Users can view company users" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

-- View: Users can view all users in their company
CREATE POLICY "Users can view company users"
ON public.users
FOR SELECT
TO authenticated
USING (
    company_id = (
        SELECT company_id FROM public.users WHERE id = auth.uid()
    )
    OR id = auth.uid()
);

-- INSERT: Users can insert their own record (CRITICAL FIX)
CREATE POLICY "Users can insert own record"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (
    id = auth.uid()
    AND company_id IS NOT NULL
);

-- INSERT: Users can insert in their company (for admin creating users)
CREATE POLICY "Users can insert in company"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND company_id = public.users.company_id
    )
);

-- UPDATE: Users can update their own record
CREATE POLICY "Users can update own record"
ON public.users
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- UPDATE: Users can update users in their company
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
-- STEP 2: FIX CONTACTS TABLE
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view company contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can insert contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can update contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can delete contacts" ON public.contacts;

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

-- Insert contacts in company (NO PERMISSION CHECK)
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

-- Delete contacts in company
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
-- STEP 3: FIX PRODUCTS TABLE
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view company products" ON public.products;
DROP POLICY IF EXISTS "Users can insert products" ON public.products;
DROP POLICY IF EXISTS "Users can update products" ON public.products;
DROP POLICY IF EXISTS "Users can delete products" ON public.products;

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

-- Insert products in company (NO PERMISSION CHECK)
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

-- Delete products in company
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
-- STEP 4: FIX BRANCHES TABLE
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view accessible branches" ON public.branches;
DROP POLICY IF EXISTS "Admins and managers can manage branches" ON public.branches;

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
-- STEP 5: FIX PRODUCT CATEGORIES TABLE
-- ============================================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view categories in company" ON public.product_categories;
DROP POLICY IF EXISTS "Users can insert categories in company" ON public.product_categories;
DROP POLICY IF EXISTS "Users can update categories in company" ON public.product_categories;

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
-- STEP 6: VERIFICATION
-- ============================================================================

-- Check policies count
SELECT 
    'POLICIES COUNT' as check_type,
    tablename,
    COUNT(*) as policy_count,
    STRING_AGG(policyname, ', ') as policy_names
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('users', 'contacts', 'products', 'branches', 'product_categories')
GROUP BY tablename
ORDER BY tablename;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ RLS POLICIES FIX COMPLETE!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'All tables now have simple INSERT/UPDATE/DELETE policies';
    RAISE NOTICE 'No permission table required for demo/testing';
    RAISE NOTICE '';
    RAISE NOTICE 'Fixed Tables:';
    RAISE NOTICE '  ✅ users - INSERT/UPDATE allowed';
    RAISE NOTICE '  ✅ contacts - Full CRUD allowed';
    RAISE NOTICE '  ✅ products - Full CRUD allowed';
    RAISE NOTICE '  ✅ branches - INSERT/UPDATE allowed';
    RAISE NOTICE '  ✅ product_categories - INSERT/UPDATE allowed';
    RAISE NOTICE '';
    RAISE NOTICE 'Next: Test data creation from frontend';
    RAISE NOTICE '========================================';
END $$;
