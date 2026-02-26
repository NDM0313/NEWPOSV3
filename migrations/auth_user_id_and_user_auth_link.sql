-- ============================================================================
-- User Creation & Login Architecture: auth_user_id + backfill
-- ============================================================================
-- 1. Add auth_user_id column (links to auth.users)
-- 2. Add last_login_at for UI display
-- 3. Backfill existing users: link by email match
-- 4. Backfill: where users.id = auth.users.id (legacy), set auth_user_id = id
-- ============================================================================

-- Add auth_user_id (nullable - staff/salesman without login have null until invited)
-- References auth.users(id) - FK optional for compatibility
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auth_user_id UUID;

-- Add last_login_at for UI
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Index for login lookup: auth_user_id = auth.uid()
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON public.users(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- Backfill 1: users where id already equals auth user id (legacy design)
DO $$ BEGIN
  UPDATE public.users u
  SET auth_user_id = u.id
  WHERE u.auth_user_id IS NULL
    AND EXISTS (SELECT 1 FROM auth.users au WHERE au.id = u.id);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Backfill 2: link by email match (case-insensitive)
DO $$ BEGIN
  UPDATE public.users u
  SET auth_user_id = au.id
  FROM auth.users au
  WHERE u.auth_user_id IS NULL
    AND LOWER(TRIM(au.email)) = LOWER(TRIM(u.email));
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Update users_read_own_row policy for auth_user_id
DROP POLICY IF EXISTS "users_read_own_row" ON public.users;
CREATE POLICY "users_read_own_row"
  ON public.users FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR auth_user_id = auth.uid());

-- Update users_update_own_profile for auth_user_id
DROP POLICY IF EXISTS "users_update_own_profile" ON public.users;
CREATE POLICY "users_update_own_profile"
  ON public.users FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR auth_user_id = auth.uid())
  WITH CHECK (id = auth.uid() OR auth_user_id = auth.uid());

-- Block INSERT/UPDATE of auth_user_id from anon/authenticated (only service role can set)
-- Admins can still insert users via Edge Function; direct insert won't set auth_user_id
-- (No policy change needed - admins_manage_users allows INSERT; we rely on Edge Function for auth)

COMMENT ON COLUMN public.users.auth_user_id IS 'Links to auth.users.id. Null = no login yet (staff/salesman record only).';
