-- ============================================================================
-- Validate p_user_id is in auth.users before inserting into user_branches/
-- user_account_access. Prevents FK violation and gives a clear error.
-- Run after rpc_user_branches_accounts_auth_id_only.sql.
-- ============================================================================

DROP FUNCTION IF EXISTS public.set_user_branches(uuid, uuid[], uuid, uuid);
DROP FUNCTION IF EXISTS public.set_user_branches(uuid, uuid[], uuid);

CREATE OR REPLACE FUNCTION public.set_user_branches(
  p_user_id uuid,
  p_branch_ids uuid[],
  p_default_branch_id uuid DEFAULT NULL,
  p_company_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  r text;
BEGIN
  r := COALESCE(get_user_role()::text, '');
  IF LOWER(TRIM(r)) <> 'admin' AND r NOT ILIKE '%admin%' THEN
    RAISE EXCEPTION 'ACCESS_DENIED: Only admin can set user branches. Current role: %', COALESCE(r, 'unknown');
  END IF;

  -- p_user_id must be auth.users(id). user_branches.user_id references auth.users(id).
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'USER_NOT_LINKED: % is not an auth user id. Assign branch access only for users who have been invited/signed up (auth_user_id set). Use Invite first for profile-only users.', p_user_id;
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

COMMENT ON FUNCTION public.set_user_branches(uuid, uuid[], uuid, uuid) IS
  'Admin-only: set branch access. p_user_id = auth.users(id). Validates id exists in auth.users.';

DROP FUNCTION IF EXISTS public.set_user_account_access(uuid, uuid[], uuid);
DROP FUNCTION IF EXISTS public.set_user_account_access(uuid, uuid[]);

CREATE OR REPLACE FUNCTION public.set_user_account_access(
  p_user_id uuid,
  p_account_ids uuid[],
  p_company_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  r text;
BEGIN
  r := COALESCE(get_user_role()::text, '');
  IF LOWER(TRIM(r)) <> 'admin' AND r NOT ILIKE '%admin%' THEN
    RAISE EXCEPTION 'ACCESS_DENIED: Only admin can set user account access. Current role: %', COALESCE(r, 'unknown');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'USER_NOT_LINKED: % is not an auth user id. Assign account access only for users who have been invited/signed up. Use Invite first for profile-only users.', p_user_id;
  END IF;

  DELETE FROM public.user_account_access WHERE user_id = p_user_id;
  IF array_length(p_account_ids, 1) IS NOT NULL AND array_length(p_account_ids, 1) > 0 THEN
    INSERT INTO public.user_account_access (user_id, account_id)
    SELECT p_user_id, unnest(p_account_ids);
  END IF;
END;
$$;

COMMENT ON FUNCTION public.set_user_account_access(uuid, uuid[], uuid) IS
  'Admin-only: set account access. p_user_id = auth.users(id). Validates id exists in auth.users.';

GRANT EXECUTE ON FUNCTION public.set_user_branches(uuid, uuid[], uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_account_access(uuid, uuid[], uuid) TO authenticated;
