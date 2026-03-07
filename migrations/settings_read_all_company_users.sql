-- ============================================================================
-- Settings: ensure all company users (including salesman) can READ settings
-- so company-level behavior (e.g. Negative Stock Allowed) applies to everyone.
-- ============================================================================
-- Problem: get_user_company_id() was sometimes defined as "id = auth.uid()" only.
-- Salesmen link via auth_user_id = auth.uid(), so they got NULL and could not
-- read settings → getAllowNegativeStock() returned false → sale blocked.
-- Fix: get_user_company_id() and get_user_role() must resolve by id OR auth_user_id.
-- ============================================================================

-- get_user_company_id: resolve by id OR auth_user_id so salesman/manager (auth_user_id) can read settings
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM public.users
  WHERE id = auth.uid() OR auth_user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_user_company_id() IS 'Resolves company_id by id or auth_user_id so all company users (admin, salesman, etc.) can read settings.';
