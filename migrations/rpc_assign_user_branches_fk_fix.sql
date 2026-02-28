-- ============================================================================
-- User Access Settings: RPC-only branch/account assignment (no direct DML).
-- Fixes: user_branches_user_id_fkey violation.
-- DB is single source of truth; frontend MUST use these RPCs only.
-- ============================================================================

-- Drop OLD overloads so only the company-scoped (4-arg / 3-arg) versions exist.
-- If you still see FK errors after applying this file once, re-run the full migration:
-- PostgREST may have been calling the old 3-arg set_user_branches instead of the 4-arg one.
DROP FUNCTION IF EXISTS public.set_user_branches(uuid, uuid[], uuid);
DROP FUNCTION IF EXISTS public.set_user_account_access(uuid, uuid[]);

-- ----------------------------------------------------------------------------
-- 1) get_public_user_id: resolve to public.users.id (FK target). Scoped by company.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_user_id(p_user_id uuid, p_company_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM public.users
  WHERE (id = p_user_id OR auth_user_id = p_user_id)
    AND (p_company_id IS NULL OR company_id = p_company_id)
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_public_user_id(uuid, uuid) IS
  'Resolves public.users.id from id or auth_user_id; scoped by company when p_company_id provided.';

-- ----------------------------------------------------------------------------
-- 2) set_user_branches: admin-only. Uses get_public_user_id; optional create from auth.
--    p_company_id REQUIRED for cross-company safety and create-from-auth.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_user_branches(
  p_user_id uuid,
  p_branch_ids uuid[],
  p_default_branch_id uuid DEFAULT NULL,
  p_company_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  r text;
  v_user_id uuid;
  v_email text;
  v_full_name text;
BEGIN
  r := COALESCE(get_user_role()::text, '');
  IF LOWER(TRIM(r)) <> 'admin' AND r NOT ILIKE '%admin%' THEN
    RAISE EXCEPTION 'ACCESS_DENIED: Only admin can set user branches. Current role: %', COALESCE(r, 'unknown');
  END IF;

  -- Resolve public.users.id inline (scoped by company) — single source of truth
  SELECT u.id INTO v_user_id
  FROM public.users u
  WHERE (u.id = p_user_id OR u.auth_user_id = p_user_id)
    AND (p_company_id IS NULL OR u.company_id = p_company_id)
  LIMIT 1;

  -- If not found and p_company_id provided, create minimal public.users from auth.users
  IF v_user_id IS NULL AND p_company_id IS NOT NULL THEN
    SELECT au.email, COALESCE(au.raw_user_meta_data->>'full_name', au.email)
      INTO v_email, v_full_name
      FROM auth.users au WHERE au.id = p_user_id LIMIT 1;
    IF v_email IS NOT NULL THEN
      INSERT INTO public.users (id, auth_user_id, company_id, email, full_name, role, is_active)
      VALUES (
        gen_random_uuid(),
        p_user_id,
        p_company_id,
        v_email,
        COALESCE(NULLIF(TRIM(v_full_name), ''), v_email),
        'staff',
        true
      )
      RETURNING id INTO v_user_id;
    END IF;
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'USER_NOT_FOUND: No public.users row for id/auth_user_id = %. Ensure user exists in public.users or pass p_company_id to create from auth.', p_user_id;
  END IF;

  -- Safety: never insert into user_branches with a user_id that is not in public.users
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_user_id LIMIT 1) THEN
    RAISE EXCEPTION 'FK_SAFETY: resolved user_id % not found in public.users. This should not happen.', v_user_id;
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

COMMENT ON FUNCTION public.set_user_branches(uuid, uuid[], uuid, uuid) IS
  'Admin-only: set branch access for a user. Resolves public.users.id via get_public_user_id; FK-safe.';

-- ----------------------------------------------------------------------------
-- 3) set_user_account_access: admin-only. Same resolution; optional create from auth.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_user_account_access(
  p_user_id uuid,
  p_account_ids uuid[],
  p_company_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  r text;
  v_user_id uuid;
  v_email text;
  v_full_name text;
BEGIN
  r := COALESCE(get_user_role()::text, '');
  IF LOWER(TRIM(r)) <> 'admin' AND r NOT ILIKE '%admin%' THEN
    RAISE EXCEPTION 'ACCESS_DENIED: Only admin can set user account access. Current role: %', COALESCE(r, 'unknown');
  END IF;

  -- Resolve public.users.id inline (scoped by company)
  SELECT u.id INTO v_user_id
  FROM public.users u
  WHERE (u.id = p_user_id OR u.auth_user_id = p_user_id)
    AND (p_company_id IS NULL OR u.company_id = p_company_id)
  LIMIT 1;

  IF v_user_id IS NULL AND p_company_id IS NOT NULL THEN
    SELECT au.email, COALESCE(au.raw_user_meta_data->>'full_name', au.email)
      INTO v_email, v_full_name
      FROM auth.users au WHERE au.id = p_user_id LIMIT 1;
    IF v_email IS NOT NULL THEN
      INSERT INTO public.users (id, auth_user_id, company_id, email, full_name, role, is_active)
      VALUES (
        gen_random_uuid(),
        p_user_id,
        p_company_id,
        v_email,
        COALESCE(NULLIF(TRIM(v_full_name), ''), v_email),
        'staff',
        true
      )
      RETURNING id INTO v_user_id;
    END IF;
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'USER_NOT_FOUND: No public.users row for id/auth_user_id = %. Ensure user exists or pass p_company_id.', p_user_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_user_id LIMIT 1) THEN
    RAISE EXCEPTION 'FK_SAFETY: resolved user_id % not found in public.users.', v_user_id;
  END IF;

  DELETE FROM public.user_account_access WHERE user_id = v_user_id;
  IF array_length(p_account_ids, 1) IS NOT NULL AND array_length(p_account_ids, 1) > 0 THEN
    INSERT INTO public.user_account_access (user_id, account_id)
    SELECT v_user_id, unnest(p_account_ids);
  END IF;
END;
$$;

COMMENT ON FUNCTION public.set_user_account_access(uuid, uuid[], uuid) IS
  'Admin-only: set account access for a user. Resolves public.users.id via get_public_user_id; FK-safe.';

-- ----------------------------------------------------------------------------
-- Grants
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.get_public_user_id(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_branches(uuid, uuid[], uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_account_access(uuid, uuid[], uuid) TO authenticated;
