-- Fix "Unauthorized" when fetching user profile: allow SELECT by id OR auth_user_id = auth.uid().
-- If the only SELECT policy is "id = auth.uid()", users whose row has auth_user_id = auth.uid() (and id != auth.uid()) cannot read their row.

DROP POLICY IF EXISTS "Users can view own row" ON public.users;
DROP POLICY IF EXISTS "users_read_own_row" ON public.users;

CREATE POLICY "users_read_own_row"
  ON public.users FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR auth_user_id = auth.uid());
