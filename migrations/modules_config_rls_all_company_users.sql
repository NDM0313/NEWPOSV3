-- ============================================================================
-- modules_config: allow all users in the company to READ (so Staff sees same
-- module toggles as Admin). Fix get_user_company_id so Staff (auth_user_id link)
-- resolve company_id.
-- ============================================================================

-- 1. Fix get_user_company_id: match by id OR auth_user_id so Staff get company_id
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM public.users WHERE id = auth.uid() OR auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 2. modules_config: all authenticated users in the company can SELECT (same as settings)
DROP POLICY IF EXISTS "Users can view company module config" ON public.modules_config;
DROP POLICY IF EXISTS "Admins can manage module config" ON public.modules_config;
CREATE POLICY "Users can view company module config"
  ON public.modules_config FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Admins can manage module config"
  ON public.modules_config FOR ALL
  TO authenticated
  USING (
    company_id = get_user_company_id()
    AND COALESCE(get_user_role()::text, '') IN ('admin', 'owner')
  )
  WITH CHECK (
    company_id = get_user_company_id()
    AND COALESCE(get_user_role()::text, '') IN ('admin', 'owner')
  );

COMMENT ON TABLE public.modules_config IS 'Module on/off per company. All company users can read; only admin/owner can update.';
