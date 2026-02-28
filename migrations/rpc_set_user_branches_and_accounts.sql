-- RPC to set user branch and account access (runs with definer rights, so RLS does not block).
-- Admin-only; call from app when direct DELETE/INSERT on user_branches returns 409.
-- If you see "user_branches_user_id_fkey" violation: (re)run this migration so the RPC
-- resolves public.users.id from either id or auth_user_id before inserting.

-- set_user_branches: replace branch access for a user (admin only).
-- p_user_id can be public.users.id OR public.users.auth_user_id (resolved to users.id for FK).
CREATE OR REPLACE FUNCTION public.set_user_branches(
  p_user_id uuid,
  p_branch_ids uuid[],
  p_default_branch_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r text;
  v_user_id uuid;
BEGIN
  r := COALESCE(get_user_role()::text, '');
  IF LOWER(TRIM(r)) <> 'admin' AND r NOT ILIKE '%admin%' THEN
    RAISE EXCEPTION 'Only admin can set user branches';
  END IF;
  SELECT id INTO v_user_id FROM public.users WHERE id = p_user_id OR auth_user_id = p_user_id LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found (id or auth_user_id = %)', p_user_id;
  END IF;
  DELETE FROM public.user_branches WHERE user_id = v_user_id;
  IF array_length(p_branch_ids, 1) IS NOT NULL AND array_length(p_branch_ids, 1) > 0 THEN
    INSERT INTO public.user_branches (user_id, branch_id, is_default)
    SELECT v_user_id, b.bid,
           (b.bid = p_default_branch_id OR (p_default_branch_id IS NULL AND b.ordinality = 1))
    FROM unnest(p_branch_ids) WITH ORDINALITY AS b(bid, ordinality);
  END IF;
END;
$$;

-- set_user_account_access: replace account access for a user (admin only).
-- p_user_id can be public.users.id OR public.users.auth_user_id (resolved to users.id for FK).
CREATE OR REPLACE FUNCTION public.set_user_account_access(
  p_user_id uuid,
  p_account_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r text;
  v_user_id uuid;
BEGIN
  r := COALESCE(get_user_role()::text, '');
  IF LOWER(TRIM(r)) <> 'admin' AND r NOT ILIKE '%admin%' THEN
    RAISE EXCEPTION 'Only admin can set user account access';
  END IF;
  SELECT id INTO v_user_id FROM public.users WHERE id = p_user_id OR auth_user_id = p_user_id LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found (id or auth_user_id = %)', p_user_id;
  END IF;
  DELETE FROM public.user_account_access WHERE user_id = v_user_id;
  IF array_length(p_account_ids, 1) IS NOT NULL AND array_length(p_account_ids, 1) > 0 THEN
    INSERT INTO public.user_account_access (user_id, account_id)
    SELECT v_user_id, unnest(p_account_ids);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_user_branches(uuid, uuid[], uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_account_access(uuid, uuid[]) TO authenticated;
