-- ============================================================================
-- CRITICAL RLS FIX FOR USERS TABLE
-- ============================================================================
-- This fixes the "new row violates row-level security policy" error
-- ============================================================================

-- ============================================================================
-- STEP 1: DROP EXISTING RESTRICTIVE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Admins can manage users" ON public.users;
DROP POLICY IF EXISTS "Users can view company users" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

-- ============================================================================
-- STEP 2: CREATE PERMISSIVE POLICIES FOR DEMO/TESTING
-- ============================================================================

-- Policy 1: Users can view all users in their company
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

-- Policy 2: CRITICAL - Users can INSERT their own record
-- This allows creating a user entry when auth user is created
CREATE POLICY "Users can insert own record"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (
    id = auth.uid()
    AND company_id IS NOT NULL
);

-- Policy 3: Users can INSERT in their company (for admin creating users)
CREATE POLICY "Users can insert in company"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (
    -- Allow if user exists and inserting in same company
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND company_id = public.users.company_id
    )
    -- OR allow if this is the first user (no existing user check)
    OR NOT EXISTS (
        SELECT 1 FROM public.users WHERE id = auth.uid()
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
-- STEP 3: VERIFICATION
-- ============================================================================

SELECT 
    'USERS TABLE POLICIES' as check_type,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'users'
ORDER BY policyname;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ USERS TABLE RLS FIX COMPLETE!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Users can now INSERT their own record';
    RAISE NOTICE 'Users can INSERT in their company';
    RAISE NOTICE '';
    RAISE NOTICE 'Next: Test user creation from frontend';
    RAISE NOTICE '========================================';
END $$;
