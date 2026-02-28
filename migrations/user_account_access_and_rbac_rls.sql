-- ============================================================================
-- USER ACCOUNT ACCESS + RBAC RLS (Enterprise User Access Management)
-- ============================================================================
-- 1. user_account_access table: per-user account access (which accounts they can use).
-- 2. Accounts RLS: admin sees all; non-admin sees only accounts in user_account_access.
-- 3. user_account_access RLS: users can see only their own rows (by user_id = auth or auth_user_id).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. user_account_access table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_account_access (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  UNIQUE(user_id, account_id)
);

CREATE INDEX IF NOT EXISTS idx_user_account_access_user ON public.user_account_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_account_access_account ON public.user_account_access(account_id);

COMMENT ON TABLE public.user_account_access IS 'Which accounts each user can access (for payment, ledger, etc.). Admin sees all via RLS.';

-- ----------------------------------------------------------------------------
-- 2. RLS on user_account_access (user sees own rows only)
-- ----------------------------------------------------------------------------
ALTER TABLE public.user_account_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_account_access_select_own" ON public.user_account_access;
CREATE POLICY "user_account_access_select_own"
  ON public.user_account_access FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  );

-- Only admin can insert/update/delete user_account_access (case-insensitive role)
DROP POLICY IF EXISTS "user_account_access_admin_manage" ON public.user_account_access;
CREATE POLICY "user_account_access_admin_manage"
  ON public.user_account_access FOR ALL TO authenticated
  USING (LOWER(TRIM(get_user_role()::text)) = 'admin')
  WITH CHECK (LOWER(TRIM(get_user_role()::text)) = 'admin');

-- ----------------------------------------------------------------------------
-- 3. Accounts RLS: admin sees all; non-admin sees only assigned accounts
-- ----------------------------------------------------------------------------
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "accounts_select_enterprise" ON public.accounts;
DROP POLICY IF EXISTS "accounts_select_policy" ON public.accounts;

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
        JOIN public.users u ON u.id = ua.user_id
        WHERE ua.account_id = accounts.id
          AND (u.id = auth.uid() OR u.auth_user_id = auth.uid())
      )
    )
  );

-- Keep existing INSERT/UPDATE/DELETE policies (admin/manager/accountant only) - do not drop if names differ
-- If your project has different policy names for accounts write, add DROP here and recreate as needed.
