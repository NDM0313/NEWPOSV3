-- ============================================================================
-- STUDIO PRODUCTION V3 – RLS (Safe Zone)
-- ============================================================================
-- Safe when studio_production_orders_v3 does not exist (no-op; run again after v3_tables).
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'studio_production_orders_v3') THEN
    RETURN;
  END IF;

  ALTER TABLE studio_production_orders_v3 ENABLE ROW LEVEL SECURITY;
  ALTER TABLE studio_production_stages_v3 ENABLE ROW LEVEL SECURITY;
  ALTER TABLE studio_production_cost_breakdown_v3 ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "Company users can manage studio production orders v3" ON studio_production_orders_v3;
  CREATE POLICY "Company users can manage studio production orders v3"
    ON studio_production_orders_v3 FOR ALL TO authenticated
    USING (company_id = get_user_company_id())
    WITH CHECK (company_id = get_user_company_id());

  DROP POLICY IF EXISTS "Company users can manage studio production stages v3" ON studio_production_stages_v3;
  CREATE POLICY "Company users can manage studio production stages v3"
    ON studio_production_stages_v3 FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM studio_production_orders_v3 o
        WHERE o.id = studio_production_stages_v3.order_id AND o.company_id = get_user_company_id()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM studio_production_orders_v3 o
        WHERE o.id = studio_production_stages_v3.order_id AND o.company_id = get_user_company_id()
      )
    );

  DROP POLICY IF EXISTS "Company users can manage studio production cost breakdown v3" ON studio_production_cost_breakdown_v3;
  CREATE POLICY "Company users can manage studio production cost breakdown v3"
    ON studio_production_cost_breakdown_v3 FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM studio_production_orders_v3 o
        WHERE o.id = studio_production_cost_breakdown_v3.production_id AND o.company_id = get_user_company_id()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM studio_production_orders_v3 o
        WHERE o.id = studio_production_cost_breakdown_v3.production_id AND o.company_id = get_user_company_id()
      )
    );
END $$;
