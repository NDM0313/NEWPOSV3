-- ============================================================================
-- IDENTITY MODEL: user_branches and user_account_access use auth.users(id) only
-- auth.users = identity | public.users = profile | user_id = auth_user_id
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. user_branches: backfill user_id to auth_user_id, then FK to auth.users
-- ----------------------------------------------------------------------------
-- Backfill: replace public.users.id with auth_user_id (drop rows that can't be resolved)
UPDATE public.user_branches ub
SET user_id = u.auth_user_id
FROM public.users u
WHERE u.id = ub.user_id AND u.auth_user_id IS NOT NULL;

DELETE FROM public.user_branches
WHERE user_id IN (SELECT id FROM public.users);

ALTER TABLE public.user_branches
  DROP CONSTRAINT IF EXISTS user_branches_user_id_fkey;

ALTER TABLE public.user_branches
  ADD CONSTRAINT user_branches_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

DO $$ BEGIN EXECUTE 'COMMENT ON TABLE public.user_branches IS ''Branch access per identity. user_id = auth.users(id). public.users is profile only.'''; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 2. user_account_access: same
-- ----------------------------------------------------------------------------
UPDATE public.user_account_access ua
SET user_id = u.auth_user_id
FROM public.users u
WHERE u.id = ua.user_id AND u.auth_user_id IS NOT NULL;

DELETE FROM public.user_account_access
WHERE user_id IN (SELECT id FROM public.users);

ALTER TABLE public.user_account_access
  DROP CONSTRAINT IF EXISTS user_account_access_user_id_fkey;

ALTER TABLE public.user_account_access
  ADD CONSTRAINT user_account_access_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

DO $$ BEGIN EXECUTE 'COMMENT ON TABLE public.user_account_access IS ''Account access per identity. user_id = auth.users(id).'''; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 3. RLS: user_branches and user_account_access — user_id = auth.uid() only
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "user_branches_select_own" ON public.user_branches;
CREATE POLICY "user_branches_select_own"
  ON public.user_branches FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_account_access_select_own" ON public.user_account_access;
CREATE POLICY "user_account_access_select_own"
  ON public.user_account_access FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 4. has_branch_access + get_user_branch_id: user_id = auth.uid() only (skip if not owner)
-- ----------------------------------------------------------------------------
DO $outer$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public' WHERE p.proname = 'has_branch_access') THEN
    CREATE FUNCTION public.has_branch_access(branch_uuid uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.user_branches WHERE user_id = auth.uid() AND branch_id = branch_uuid); $$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public' WHERE p.proname = 'get_user_branch_id') THEN
    CREATE FUNCTION public.get_user_branch_id() RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$ SELECT COALESCE((SELECT ub.branch_id FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.is_default = true LIMIT 1),(SELECT ub.branch_id FROM public.user_branches ub WHERE ub.user_id = auth.uid() LIMIT 1)); $$;
  END IF;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipping has_branch_access/get_user_branch_id (not owner).'; END $outer$;

-- ----------------------------------------------------------------------------
-- 5. Accounts RLS: non-admin sees accounts via user_account_access.user_id = auth.uid()
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "accounts_select_enterprise" ON public.accounts;
CREATE POLICY "accounts_select_enterprise"
  ON public.accounts FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      get_user_role() = 'admin'
      OR get_user_role() = 'manager'
      OR get_user_role() = 'accountant'
      OR EXISTS (
        SELECT 1 FROM public.user_account_access ua
        WHERE ua.account_id = accounts.id AND ua.user_id = auth.uid()
      )
    )
  );
