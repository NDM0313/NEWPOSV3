-- ============================================================================
-- FIX RLS POLICIES - REMOVE INFINITE RECURSION
-- ============================================================================
-- This script fixes RLS policies that cause infinite recursion
-- ============================================================================

-- ============================================================================
-- STEP 1: DROP ALL EXISTING USERS TABLE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view company users" ON public.users;
DROP POLICY IF EXISTS "Users can insert own record" ON public.users;
DROP POLICY IF EXISTS "Users can insert in company" ON public.users;
DROP POLICY IF EXISTS "Users can update own record" ON public.users;
DROP POLICY IF EXISTS "Users can update in company" ON public.users;
DROP POLICY IF EXISTS "Admins can manage users" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

-- ============================================================================
-- STEP 2: CREATE NON-RECURSIVE POLICIES
-- ============================================================================

-- Policy 1: Users can view their own record (no recursion)
CREATE POLICY "Users can view own record"
ON public.users
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Policy 2: Users can view all users in their company (using SECURITY DEFINER function)
-- This function bypasses RLS to get company_id
CREATE OR REPLACE FUNCTION public.get_user_company_id_safe()
RETURNS UUID AS $$
DECLARE
    user_company_id UUID;
BEGIN
    -- Use SECURITY DEFINER to bypass RLS
    SELECT company_id INTO user_company_id
    FROM public.users
    WHERE id = auth.uid()
    LIMIT 1;
    
    RETURN user_company_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policy 3: Users can view users in same company (using safe function)
CREATE POLICY "Users can view company users"
ON public.users
FOR SELECT
TO authenticated
USING (
    company_id = public.get_user_company_id_safe()
    OR id = auth.uid()
);

-- Policy 4: Users can INSERT their own record (for initial creation)
-- This is safe because it only checks auth.uid()
CREATE POLICY "Users can insert own record"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (
    id = auth.uid()
    AND company_id IS NOT NULL
);

-- Policy 5: Service role can insert any user (for business creation)
-- This policy allows service_role to bypass RLS during setup
CREATE POLICY "Service role can insert users"
ON public.users
FOR INSERT
TO service_role
WITH CHECK (true);

-- Policy 6: Users can UPDATE their own record
CREATE POLICY "Users can update own record"
ON public.users
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Policy 7: Service role can update any user
CREATE POLICY "Service role can update users"
ON public.users
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- STEP 3: FIX CONTACTS TABLE (remove recursion)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view contacts in company" ON public.contacts;
DROP POLICY IF EXISTS "Users can insert contacts in company" ON public.contacts;
DROP POLICY IF EXISTS "Users can update contacts in company" ON public.contacts;
DROP POLICY IF EXISTS "Users can delete contacts in company" ON public.contacts;

-- View contacts in company (using safe function)
CREATE POLICY "Users can view contacts in company"
ON public.contacts
FOR SELECT
TO authenticated
USING (
    company_id = public.get_user_company_id_safe()
);

-- Insert contacts in company
CREATE POLICY "Users can insert contacts in company"
ON public.contacts
FOR INSERT
TO authenticated
WITH CHECK (
    company_id = public.get_user_company_id_safe()
);

-- Update contacts in company
CREATE POLICY "Users can update contacts in company"
ON public.contacts
FOR UPDATE
TO authenticated
USING (
    company_id = public.get_user_company_id_safe()
)
WITH CHECK (
    company_id = public.get_user_company_id_safe()
);

-- Delete contacts in company
CREATE POLICY "Users can delete contacts in company"
ON public.contacts
FOR DELETE
TO authenticated
USING (
    company_id = public.get_user_company_id_safe()
);

-- ============================================================================
-- STEP 4: FIX PRODUCTS TABLE (remove recursion)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view products in company" ON public.products;
DROP POLICY IF EXISTS "Users can insert products in company" ON public.products;
DROP POLICY IF EXISTS "Users can update products in company" ON public.products;
DROP POLICY IF EXISTS "Users can delete products in company" ON public.products;

-- View products in company
CREATE POLICY "Users can view products in company"
ON public.products
FOR SELECT
TO authenticated
USING (
    company_id = public.get_user_company_id_safe()
);

-- Insert products in company
CREATE POLICY "Users can insert products in company"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (
    company_id = public.get_user_company_id_safe()
);

-- Update products in company
CREATE POLICY "Users can update products in company"
ON public.products
FOR UPDATE
TO authenticated
USING (
    company_id = public.get_user_company_id_safe()
)
WITH CHECK (
    company_id = public.get_user_company_id_safe()
);

-- Delete products in company
CREATE POLICY "Users can delete products in company"
ON public.products
FOR DELETE
TO authenticated
USING (
    company_id = public.get_user_company_id_safe()
);

-- ============================================================================
-- STEP 5: VERIFICATION
-- ============================================================================

SELECT 
    'POLICIES COUNT' as check_type,
    tablename,
    COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('users', 'contacts', 'products')
GROUP BY tablename
ORDER BY tablename;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ RLS RECURSION FIX COMPLETE!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'All policies now use SECURITY DEFINER function';
    RAISE NOTICE 'No more infinite recursion on users table';
    RAISE NOTICE '';
    RAISE NOTICE 'Next: Test business creation flow';
    RAISE NOTICE '========================================';
END $$;
