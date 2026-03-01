-- ============================================================================
-- HEALTH DASHBOARD: Permission Engine Integrity component
-- Run after erp_permission_engine_v1.sql
-- Adds checks: role_permissions rows, base visibility, no user without role, owner per company.
-- ============================================================================

-- Function: returns permission-engine health rows (admin/owner only)
CREATE OR REPLACE FUNCTION public.get_erp_health_dashboard_permission_checks()
RETURNS TABLE(component TEXT, status TEXT, details TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF COALESCE(get_user_role()::text, '') NOT IN ('admin', 'owner') THEN
    RETURN;
  END IF;

  -- role_permissions table exists and has rows for each engine role
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'role_permissions') THEN
    RETURN QUERY SELECT 'Permission Engine Integrity'::TEXT, 'SKIP'::TEXT, 'role_permissions table does not exist'::TEXT;
    RETURN;
  END IF;

  IF (SELECT COUNT(DISTINCT role) FROM public.role_permissions) < 4 THEN
    RETURN QUERY SELECT 'Permission Engine Integrity'::TEXT, 'FAIL'::TEXT,
      ('Only ' || (SELECT COUNT(DISTINCT role)::TEXT FROM public.role_permissions) || ' roles in role_permissions; expected owner, admin, manager, user')::TEXT;
    RETURN;
  END IF;

  -- Base visibility: at least one of view_own, view_branch, view_company for sales per role
  IF EXISTS (
    SELECT 1 FROM (SELECT DISTINCT role FROM public.role_permissions) r
    WHERE NOT EXISTS (
      SELECT 1 FROM public.role_permissions rp
      WHERE rp.role = r.role AND rp.module = 'sales'
        AND rp.action IN ('view_own', 'view_branch', 'view_company') AND rp.allowed = true
    )
  ) THEN
    RETURN QUERY SELECT 'Permission Engine Integrity'::TEXT, 'FAIL'::TEXT,
      'At least one role missing base sales visibility (view_own/view_branch/view_company)'::TEXT;
    RETURN;
  END IF;

  -- No user without role (empty or null role)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role') THEN
      IF (SELECT COUNT(*) FROM public.users WHERE role IS NULL OR TRIM(COALESCE(role::text, '')) = '') > 0 THEN
        RETURN QUERY SELECT 'Permission Engine Integrity'::TEXT, 'FAIL'::TEXT,
          (SELECT COUNT(*)::TEXT FROM public.users WHERE role IS NULL OR TRIM(COALESCE(role::text, '')) = '') || ' user(s) without role'::TEXT;
        RETURN;
      END IF;
    END IF;
  END IF;

  -- Owner exists per company
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    IF EXISTS (
      SELECT 1 FROM (SELECT DISTINCT company_id FROM public.users WHERE company_id IS NOT NULL) c
      WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.company_id = c.company_id AND u.role::text = 'owner')
    ) THEN
      RETURN QUERY SELECT 'Permission Engine Integrity'::TEXT, 'FAIL'::TEXT,
        'At least one company has no owner'::TEXT;
      RETURN;
    END IF;
  END IF;

  RETURN QUERY SELECT 'Permission Engine Integrity'::TEXT, 'OK'::TEXT,
    'Roles seeded; base visibility set; no user without role; owner per company'::TEXT;
END;
$$;

-- Update view to include permission engine checks (append to dashboard)
DROP VIEW IF EXISTS public.erp_health_dashboard;

CREATE VIEW public.erp_health_dashboard AS
SELECT component, status, details FROM public.get_erp_health_dashboard()
UNION ALL
SELECT component, status, details FROM public.get_erp_health_dashboard_permission_checks();

COMMENT ON FUNCTION public.get_erp_health_dashboard_permission_checks() IS 'Health dashboard: permission engine integrity (admin/owner only).';
