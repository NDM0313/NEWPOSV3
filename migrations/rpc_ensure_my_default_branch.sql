-- ============================================================================
-- RPC: Ensure current user has at least one branch (auto-fix for non-admin).
-- Works whether user_branches.user_id references public.users(id) or auth.users(id).
-- Call from frontend when user has 0 branches; then reload branches.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ensure_my_default_branch()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_uid uuid;
  v_company_id uuid;
  v_public_id uuid;
  v_role text;
  v_branch_id uuid;
  v_user_id_for_insert uuid;
  v_fk_target regclass;
  v_already int;
BEGIN
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT id, company_id, role::text INTO v_public_id, v_company_id, v_role
  FROM public.users
  WHERE auth_user_id = v_auth_uid OR id = v_auth_uid
  LIMIT 1;

  IF v_public_id IS NULL OR v_company_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User or company not found');
  END IF;

  IF v_role IS NOT NULL AND LOWER(TRIM(v_role)) IN ('owner', 'admin') THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'Admin has full access');
  END IF;

  SELECT 1 INTO v_already FROM public.user_branches
  WHERE user_id = v_public_id OR user_id = v_auth_uid
  LIMIT 1;
  IF v_already = 1 THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'Already has branch');
  END IF;

  SELECT id INTO v_branch_id FROM public.branches
  WHERE company_id = v_company_id AND (is_active IS NULL OR is_active = true)
  ORDER BY id ASC
  LIMIT 1;

  IF v_branch_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No branch found for company');
  END IF;

  SELECT c.confrelid INTO v_fk_target
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  WHERE t.relname = 'user_branches' AND c.conname = 'user_branches_user_id_fkey'
  LIMIT 1;

  -- confrelid::text is like 'auth.users' or 'users' (public)
  IF v_fk_target IS NULL OR (v_fk_target::text NOT LIKE 'auth.%') THEN
    v_user_id_for_insert := v_public_id;
  ELSE
    v_user_id_for_insert := v_auth_uid;
  END IF;

  INSERT INTO public.user_branches (user_id, branch_id, is_default)
  VALUES (v_user_id_for_insert, v_branch_id, true);

  RETURN jsonb_build_object('success', true, 'branch_id', v_branch_id, 'assigned', true);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'Row already exists');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.ensure_my_default_branch() IS 'Assigns default company branch to current user if they have none. Works for both public.users and auth.users FK.';

GRANT EXECUTE ON FUNCTION public.ensure_my_default_branch() TO authenticated;
