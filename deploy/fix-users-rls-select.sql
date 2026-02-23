-- Fix users SELECT: infinite recursion (policy called get_user_company_id which queries users).
-- Minimal fix: user can read ONLY their own row. No subqueries on users.

DROP POLICY IF EXISTS "Users can view company users" ON public.users;
DROP POLICY IF EXISTS "Users can view own row" ON public.users;

CREATE POLICY "Users can view own row"
ON public.users
FOR SELECT
TO authenticated
USING (id = auth.uid());
