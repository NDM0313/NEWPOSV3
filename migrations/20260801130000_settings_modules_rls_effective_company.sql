-- Fix settings + modules_config RLS for platform company session.
-- Symptom: 403 on settings upsert (accounting_settings) and modules_config when a
-- developer/super_admin has switched active company (users.company_id stays HOME).
-- get_user_company_id() already returns platform_company_session.active_company_id.

DROP POLICY IF EXISTS "rls_fix_company" ON public.settings;
CREATE POLICY settings_company_effective
  ON public.settings
  FOR ALL
  TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

COMMENT ON POLICY settings_company_effective ON public.settings IS
  'Company-scoped settings CRUD using get_user_company_id (includes platform session).';

-- modules_config: replace home-company ALL policy; widen admin write to platform ops
DROP POLICY IF EXISTS "rls_fix_company" ON public.modules_config;
DROP POLICY IF EXISTS "Admins can manage module config" ON public.modules_config;
CREATE POLICY modules_config_admin_manage
  ON public.modules_config
  FOR ALL
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND public.is_admin_or_owner()
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND public.is_admin_or_owner()
  );

DROP POLICY IF EXISTS "Users can view company module config" ON public.modules_config;
CREATE POLICY modules_config_select_company
  ON public.modules_config
  FOR SELECT
  TO authenticated
  USING (company_id = public.get_user_company_id());

COMMENT ON POLICY modules_config_admin_manage ON public.modules_config IS
  'Admin/owner/platform-ops manage module flags for effective company.';
COMMENT ON POLICY modules_config_select_company ON public.modules_config IS
  'Company users can read module config for effective company.';
