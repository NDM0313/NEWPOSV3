-- ============================================================================
-- Verify accounts RLS setup (run in Supabase SQL Editor as postgres)
-- Use this if default account creation still returns 403 after applying
-- accounts_rls_allow_default_accounts.sql
-- ============================================================================

-- 1) Check that get_user_company_id exists
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'get_user_company_id';

-- 2) List users and their company_id
--    The user you log in as MUST have company_id set; otherwise INSERT is denied.
SELECT id, email, full_name, company_id, role, is_active
FROM public.users
ORDER BY created_at DESC
LIMIT 20;

-- 3) FIX: If your login user has company_id = NULL, set it (use IDs from step 2 and companies table):
--    UPDATE public.users SET company_id = '<company_uuid>' WHERE id = '<your_user_uuid>';

-- 4) Drop duplicate policy so only get_user_company_id() is used (run if 403 persists):
--    DROP POLICY IF EXISTS "rls_fix_company" ON accounts;

-- 5) Confirm accounts policies (should see accounts_*_company only; no rls_fix_company)
SELECT policyname, cmd, qual::text, with_check::text
FROM pg_policies
WHERE tablename = 'accounts';
