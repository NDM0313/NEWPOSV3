-- Allow admin to INSERT, UPDATE, DELETE on user_branches (for Settings → Edit User → Branch Access).
-- Without this, admin cannot save branch assignments and you get 403/409.

ALTER TABLE public.user_branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_branches_admin_manage" ON public.user_branches;
CREATE POLICY "user_branches_admin_manage"
  ON public.user_branches FOR ALL TO authenticated
  USING (
    LOWER(TRIM(COALESCE(get_user_role()::text, ''))) = 'admin'
    OR COALESCE(get_user_role()::text, '') ILIKE '%admin%'
  )
  WITH CHECK (
    LOWER(TRIM(COALESCE(get_user_role()::text, ''))) = 'admin'
    OR COALESCE(get_user_role()::text, '') ILIKE '%admin%'
  );
