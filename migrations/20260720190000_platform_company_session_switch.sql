-- Platform Developer / Super Admin: one-company-at-a-time session switch
-- Approval: APPROVE_PLATFORM_COMPANY_SWITCH_RPC
-- Additive only — no DROP TABLE / bulk policy replace / permanent users.company_id rewrite.

-- ---------------------------------------------------------------------------
-- 1) Enum values for platform roles (users.role)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'developer';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'super_admin';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 2) Session override table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_company_session (
  auth_user_id uuid PRIMARY KEY,
  active_company_id uuid NOT NULL REFERENCES public.companies(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_company_session_company
  ON public.platform_company_session (active_company_id);

ALTER TABLE public.platform_company_session ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_company_session_select_own ON public.platform_company_session;
CREATE POLICY platform_company_session_select_own
  ON public.platform_company_session
  FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS platform_company_session_insert_own ON public.platform_company_session;
CREATE POLICY platform_company_session_insert_own
  ON public.platform_company_session
  FOR INSERT
  TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

DROP POLICY IF EXISTS platform_company_session_update_own ON public.platform_company_session;
CREATE POLICY platform_company_session_update_own
  ON public.platform_company_session
  FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

DROP POLICY IF EXISTS platform_company_session_delete_own ON public.platform_company_session;
CREATE POLICY platform_company_session_delete_own
  ON public.platform_company_session
  FOR DELETE
  TO authenticated
  USING (auth_user_id = auth.uid());

COMMENT ON TABLE public.platform_company_session IS
  'Active company override for platform operators (developer/super_admin). Home users.company_id is unchanged.';

-- ---------------------------------------------------------------------------
-- 3) is_platform_company_operator()
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_platform_company_operator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(trim(COALESCE(public.get_user_role()::text, '')))
    IN ('developer', 'super_admin', 'superadmin', 'super admin');
$$;

COMMENT ON FUNCTION public.is_platform_company_operator() IS
  'True when caller users.role is developer / super_admin (platform company switch).';

GRANT EXECUTE ON FUNCTION public.is_platform_company_operator() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_company_operator() TO service_role;

-- ---------------------------------------------------------------------------
-- 4) Patch get_user_company_id() — COALESCE session override for platform ops only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT pcs.active_company_id
      FROM public.platform_company_session pcs
      WHERE pcs.auth_user_id = auth.uid()
        AND public.is_platform_company_operator()
      LIMIT 1
    ),
    (
      SELECT u.company_id
      FROM public.users u
      WHERE u.auth_user_id = auth.uid() OR u.id = auth.uid()
      ORDER BY CASE WHEN u.auth_user_id = auth.uid() THEN 0 ELSE 1 END
      LIMIT 1
    )
  );
$$;

COMMENT ON FUNCTION public.get_user_company_id() IS
  'Effective company: platform session override when operator, else users.company_id.';

-- ---------------------------------------------------------------------------
-- 5) Admin-equivalent write gate for platform operators
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_owner_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.get_user_role()::text, '') IN ('owner', 'admin')
    OR public.is_platform_company_operator();
$$;

-- Production may own is_admin_or_owner as supabase_admin; fall back gracefully.
DO $outer$
BEGIN
  EXECUTE $fn$
    CREATE OR REPLACE FUNCTION public.is_admin_or_owner()
    RETURNS boolean
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $body$
      SELECT COALESCE(public.get_user_role()::text, '') IN ('admin', 'owner')
        OR public.is_platform_company_operator();
    $body$
  $fn$;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'is_admin_or_owner: insufficient privilege as % — re-run that CREATE as supabase_admin', current_user;
END
$outer$;

COMMENT ON FUNCTION public.is_owner_or_admin() IS
  'True if owner/admin or platform company operator (developer/super_admin).';

DO $c$
BEGIN
  COMMENT ON FUNCTION public.is_admin_or_owner() IS
    'True if admin/owner or platform company operator (developer/super_admin).';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'is_admin_or_owner comment skipped: %', SQLERRM;
END
$c$;
-- ---------------------------------------------------------------------------
-- 6) RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_effective_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_user_company_id();
$$;

COMMENT ON FUNCTION public.get_effective_company_id() IS
  'Client-facing wrapper for get_user_company_id (includes platform session).';

GRANT EXECUTE ON FUNCTION public.get_effective_company_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_effective_company_id() TO service_role;

CREATE OR REPLACE FUNCTION public.list_platform_companies()
RETURNS TABLE (
  id uuid,
  name text,
  is_active boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_company_operator() THEN
    RAISE EXCEPTION 'ACCESS_DENIED: platform company list requires developer/super_admin'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT c.id, c.name::text, COALESCE(c.is_active, true)
  FROM public.companies c
  WHERE COALESCE(c.is_active, true) = true
  ORDER BY c.name;
END;
$$;

COMMENT ON FUNCTION public.list_platform_companies() IS
  'Lists active companies for platform operators only.';

GRANT EXECUTE ON FUNCTION public.list_platform_companies() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_platform_companies() TO service_role;

CREATE OR REPLACE FUNCTION public.set_platform_active_company(p_company_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'ACCESS_DENIED: not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_platform_company_operator() THEN
    RAISE EXCEPTION 'ACCESS_DENIED: platform company switch requires developer/super_admin'
      USING ERRCODE = '42501';
  END IF;

  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT: company_id required' USING ERRCODE = '22023';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = p_company_id AND COALESCE(c.is_active, true) = true
  ) INTO v_ok;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'NOT_FOUND: company inactive or missing' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.platform_company_session (auth_user_id, active_company_id, updated_at)
  VALUES (auth.uid(), p_company_id, now())
  ON CONFLICT (auth_user_id) DO UPDATE
    SET active_company_id = EXCLUDED.active_company_id,
        updated_at = now();

  RETURN p_company_id;
END;
$$;

COMMENT ON FUNCTION public.set_platform_active_company(uuid) IS
  'Upserts platform_company_session for caller; does not rewrite users.company_id.';

GRANT EXECUTE ON FUNCTION public.set_platform_active_company(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_platform_active_company(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.clear_platform_active_company()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'ACCESS_DENIED: not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_platform_company_operator() THEN
    RAISE EXCEPTION 'ACCESS_DENIED: platform company clear requires developer/super_admin'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.platform_company_session WHERE auth_user_id = auth.uid();
END;
$$;

COMMENT ON FUNCTION public.clear_platform_active_company() IS
  'Clears platform session override; effective company returns to users.company_id.';

GRANT EXECUTE ON FUNCTION public.clear_platform_active_company() TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_platform_active_company() TO service_role;

CREATE OR REPLACE FUNCTION public.get_platform_active_company()
RETURNS TABLE (
  active_company_id uuid,
  company_name text,
  home_company_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_home uuid;
  v_active uuid;
  v_name text;
BEGIN
  IF NOT public.is_platform_company_operator() THEN
    RETURN;
  END IF;

  SELECT u.company_id INTO v_home
  FROM public.users u
  WHERE u.auth_user_id = auth.uid() OR u.id = auth.uid()
  ORDER BY CASE WHEN u.auth_user_id = auth.uid() THEN 0 ELSE 1 END
  LIMIT 1;

  SELECT pcs.active_company_id INTO v_active
  FROM public.platform_company_session pcs
  WHERE pcs.auth_user_id = auth.uid()
  LIMIT 1;

  IF v_active IS NOT NULL THEN
    SELECT c.name::text INTO v_name FROM public.companies c WHERE c.id = v_active LIMIT 1;
  END IF;

  RETURN QUERY SELECT v_active, v_name, v_home;
END;
$$;

COMMENT ON FUNCTION public.get_platform_active_company() IS
  'Returns platform session + home company for operator UI; empty for non-operators.';

GRANT EXECUTE ON FUNCTION public.get_platform_active_company() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_platform_active_company() TO service_role;
