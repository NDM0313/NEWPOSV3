-- ============================================================================
-- RPC: Branch/account assignment by auth.users(id) only. No public.users resolution.
-- Run after identity_model_auth_user_id.sql. p_user_id = auth_user_id only.
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
SET search_path = public
AS $$
DECLARE
  r text;
BEGIN
  r := COALESCE(get_user_role()::text, '');
  IF LOWER(TRIM(r)) <> 'admin' AND r NOT ILIKE '%admin%' THEN
    RAISE EXCEPTION 'ACCESS_DENIED: Only admin can set user branches. Current role: %', COALESCE(r, 'unknown');
  END IF;

  -- p_user_id = auth.users(id) only. No resolution, no create-from-auth.
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
  'Admin-only: set branch access. p_user_id = auth.users(id). No public.users resolution.';

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
SET search_path = public
AS $$
DECLARE
  r text;
BEGIN
  r := COALESCE(get_user_role()::text, '');
  IF LOWER(TRIM(r)) <> 'admin' AND r NOT ILIKE '%admin%' THEN
    RAISE EXCEPTION 'ACCESS_DENIED: Only admin can set user account access. Current role: %', COALESCE(r, 'unknown');
  END IF;

  -- p_user_id = auth.users(id) only.
  DELETE FROM public.user_account_access WHERE user_id = p_user_id;
  IF array_length(p_account_ids, 1) IS NOT NULL AND array_length(p_account_ids, 1) > 0 THEN
    INSERT INTO public.user_account_access (user_id, account_id)
    SELECT p_user_id, unnest(p_account_ids);
  END IF;
END;
$$;

COMMENT ON FUNCTION public.set_user_account_access(uuid, uuid[], uuid) IS
  'Admin-only: set account access. p_user_id = auth.users(id). No public.users resolution.';

GRANT EXECUTE ON FUNCTION public.set_user_branches(uuid, uuid[], uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_account_access(uuid, uuid[], uuid) TO authenticated;
