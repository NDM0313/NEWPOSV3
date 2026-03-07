-- ============================================================================
-- UNITS & BRANDS RLS: All company users can read (fix Salesman not seeing units)
-- ============================================================================
-- Problem: units_company policy used "users WHERE id = auth.uid()" so only
-- users whose public.users.id = auth.uid() could see units. Salesman/staff
-- are often linked by auth_user_id, so they got no rows.
-- Fix: Use get_user_company_id() so any user in the company (id or auth_user_id)
-- can SELECT units and brands. Run modules_config_rls_all_company_users.sql first
-- if get_user_company_id() does not exist or does not use auth_user_id.
-- ============================================================================

-- Units: company-scoped (all authenticated users in same company can read)
DROP POLICY IF EXISTS "units_company" ON public.units;
CREATE POLICY "units_company" ON public.units
  FOR ALL TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

COMMENT ON TABLE public.units IS 'Inventory units per company (Piece, Meter, Kg). RLS: all company users can read; create/edit via Settings → Inventory → Units.';

-- Brands: same fix so salesman can see brands in product form
DROP POLICY IF EXISTS "brands_company" ON public.brands;
CREATE POLICY "brands_company" ON public.brands
  FOR ALL TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

COMMENT ON TABLE public.brands IS 'Product brands per company. RLS: all company users can read.';
