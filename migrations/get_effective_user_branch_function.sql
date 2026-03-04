-- ============================================================================
-- BRANCH ARCHITECTURE: Single vs multi-branch
-- Branch logic depends on company branch count, not only user_branches.
-- ============================================================================
-- REQUIRED: Run this in Supabase SQL Editor (or your migration runner) so the
-- app can load branch context. Without it you'll see:
--   [BRANCH LOAD] get_effective_user_branch failed, using fallback
-- ============================================================================
-- get_effective_user_branch(p_user_id): p_user_id can be auth.users.id or public.users.id.
-- Returns: effective_branch_id, branch_count, accessible_branch_ids.
-- If company has 1 branch -> return that branch (no user_branches needed).
-- If company has >1 branches -> return from user_branches or NULL.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_effective_user_branch(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_public_id uuid;
  v_branch_count int;
  v_branch_id uuid;
  v_accessible uuid[];
  v_default_id uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('effective_branch_id', null, 'branch_count', 0, 'accessible_branch_ids', '[]'::jsonb, 'requires_branch_selection', false);
  END IF;

  SELECT id, company_id INTO v_public_id, v_company_id
  FROM public.users
  WHERE id = p_user_id OR auth_user_id = p_user_id
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object('effective_branch_id', null, 'branch_count', 0, 'accessible_branch_ids', '[]'::jsonb, 'requires_branch_selection', false);
  END IF;

  SELECT COUNT(*) INTO v_branch_count
  FROM public.branches
  WHERE company_id = v_company_id AND (is_active IS NULL OR is_active = true);

  IF v_branch_count = 0 THEN
    RETURN jsonb_build_object('effective_branch_id', null, 'branch_count', 0, 'accessible_branch_ids', '[]'::jsonb, 'requires_branch_selection', false);
  END IF;

  IF v_branch_count = 1 THEN
    SELECT id INTO v_branch_id
    FROM public.branches
    WHERE company_id = v_company_id AND (is_active IS NULL OR is_active = true)
    LIMIT 1;
    RETURN jsonb_build_object(
      'effective_branch_id', v_branch_id,
      'branch_count', 1,
      'accessible_branch_ids', jsonb_build_array(v_branch_id),
      'requires_branch_selection', false
    );
  END IF;

  -- Multi-branch: use user_branches (try both p_user_id and public id)
  SELECT array_agg(ub.branch_id ORDER BY ub.is_default DESC NULLS LAST, ub.branch_id),
         (SELECT ub2.branch_id FROM public.user_branches ub2
          WHERE ub2.user_id = p_user_id OR ub2.user_id = v_public_id
          ORDER BY ub2.is_default DESC NULLS LAST
          LIMIT 1)
  INTO v_accessible, v_default_id
  FROM public.user_branches ub
  WHERE ub.user_id = p_user_id OR ub.user_id = v_public_id;

  v_branch_id := v_default_id;
  IF v_accessible IS NULL THEN
    v_accessible := ARRAY[]::uuid[];
  END IF;

  RETURN jsonb_build_object(
    'effective_branch_id', v_branch_id,
    'branch_count', v_branch_count,
    'accessible_branch_ids', COALESCE((SELECT jsonb_agg(x) FROM unnest(v_accessible) AS x), '[]'::jsonb),
    'requires_branch_selection', (v_branch_count > 1 AND v_branch_id IS NULL)
  );
END;
$$;

COMMENT ON FUNCTION public.get_effective_user_branch(uuid) IS
  'Single vs multi-branch: if company has 1 branch returns it; else returns user_branches default. p_user_id = auth or public user id.';

GRANT EXECUTE ON FUNCTION public.get_effective_user_branch(uuid) TO authenticated;

-- Optional: policy / RLS - function uses SECURITY DEFINER and only reads users/branches/user_branches;
-- no RLS change required on tables. Caller must pass their own user id (from auth.uid() or profile).
