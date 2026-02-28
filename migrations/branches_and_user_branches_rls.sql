-- ============================================================================
-- BRANCHES + USER_BRANCHES RLS (fix "No branch available" for salesman)
-- ============================================================================
-- 1. Branches: Admin sees all company branches; non-admin sees only branches
--    they are assigned to via user_branches (has_branch_access).
-- 2. user_branches: User can SELECT rows where they are the assigned user
--    (user_id = auth.uid() OR user_id = their public.users.id when auth_user_id = auth.uid()).
--    This fixes salesman/invited users whose public.users.id != auth.uid().
-- ============================================================================

-- Ensure branches has RLS (may already be enabled by extract)
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- Drop existing branches SELECT policies if present (avoid duplicates)
DROP POLICY IF EXISTS "Users can view accessible branches" ON public.branches;
DROP POLICY IF EXISTS "branches_select_enterprise" ON public.branches;

-- Branches SELECT: admin = all company; others = only branches they have access to
CREATE POLICY "branches_select_enterprise"
  ON public.branches FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      get_user_role() = 'admin'
      OR has_branch_access(id)
    )
  );

-- user_branches: allow user to see their own assignments (by auth.uid() OR by public user id)
ALTER TABLE public.user_branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own user_branches" ON public.user_branches;
DROP POLICY IF EXISTS "user_branches_select_own" ON public.user_branches;
-- Allow SELECT where current user is the assigned user (id or auth_user_id = auth.uid())
CREATE POLICY "user_branches_select_own"
  ON public.user_branches FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  );

-- Optional: restrict INSERT/UPDATE/DELETE on user_branches to admin only (if you want)
-- Here we leave existing policies as-is if any; add only SELECT fix above.
