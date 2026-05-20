-- Allow company owner (same as admin) to manage users via PostgREST and branch/account RPCs.
-- Edge Function create-erp-user already permits owner; this aligns RLS + set_user_* RPCs.

DROP POLICY IF EXISTS "admins_manage_users" ON public.users;
CREATE POLICY "admins_manage_users"
  ON public.users FOR ALL
  TO authenticated
  USING (
    company_id = get_user_company_id()
    AND COALESCE(LOWER(TRIM(get_user_role())), '') IN ('admin', 'owner')
  )
  WITH CHECK (
    company_id = get_user_company_id()
    AND COALESCE(LOWER(TRIM(get_user_role())), '') IN ('admin', 'owner')
  );

COMMENT ON POLICY "admins_manage_users" ON public.users IS
  'Company admin or owner can insert/update/delete users in their company.';

-- set_user_branches: permit owner
CREATE OR REPLACE FUNCTION public.set_user_branches(
  p_user_id uuid,
  p_branch_ids uuid[],
  p_default_branch_id uuid DEFAULT NULL,
  p_company_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r text;
BEGIN
  r := COALESCE(LOWER(TRIM(get_user_role()::text)), '');
  IF r NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'ACCESS_DENIED: Only admin or owner can set user branches. Current role: %', COALESCE(r, 'unknown');
  END IF;

  DELETE FROM public.user_branches WHERE user_id = p_user_id;
  IF array_length(p_branch_ids, 1) IS NOT NULL AND array_length(p_branch_ids, 1) > 0 THEN
    INSERT INTO public.user_branches (user_id, branch_id, is_default)
    SELECT p_user_id, b.bid,
           (b.bid = p_default_branch_id OR (p_default_branch_id IS NULL AND b.ordinality = 1))
    FROM unnest(p_branch_ids) WITH ORDINALITY AS b(bid, ordinality);
  END IF;
END;
$$;

-- set_user_account_access: permit owner
CREATE OR REPLACE FUNCTION public.set_user_account_access(
  p_user_id uuid,
  p_account_ids uuid[],
  p_company_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r text;
BEGIN
  r := COALESCE(LOWER(TRIM(get_user_role()::text)), '');
  IF r NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'ACCESS_DENIED: Only admin or owner can set user account access. Current role: %', COALESCE(r, 'unknown');
  END IF;

  DELETE FROM public.user_account_access WHERE user_id = p_user_id;
  IF array_length(p_account_ids, 1) IS NOT NULL AND array_length(p_account_ids, 1) > 0 THEN
    INSERT INTO public.user_account_access (user_id, account_id)
    SELECT p_user_id, unnest(p_account_ids);
  END IF;
END;
$$;
