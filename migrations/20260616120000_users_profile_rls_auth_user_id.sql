-- Restore auth_user_id-aware self-service profile policies on public.users.
-- fix_users_rls_recursion.sql reverted to id = auth.uid() only; users linked via auth_user_id could not read/update own profile.

DROP POLICY IF EXISTS "users_read_own_row" ON public.users;
CREATE POLICY "users_read_own_row"
  ON public.users FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR auth_user_id = auth.uid());

DROP POLICY IF EXISTS "users_update_own_profile" ON public.users;
CREATE POLICY "users_update_own_profile"
  ON public.users FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR auth_user_id = auth.uid())
  WITH CHECK (id = auth.uid() OR auth_user_id = auth.uid());

COMMENT ON POLICY "users_read_own_row" ON public.users IS
  'Self read: legacy id=auth.uid() or identity via auth_user_id.';
COMMENT ON POLICY "users_update_own_profile" ON public.users IS
  'Self update (full_name, phone, etc.): id or auth_user_id = auth.uid().';
