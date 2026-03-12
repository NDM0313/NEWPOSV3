-- ============================================================================
-- STUDIO PRODUCTION V2 – RLS (Safe Zone)
-- ============================================================================
-- Safe when studio_production_orders_v2 does not exist (no-op; run again after v2_tables).
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'studio_production_orders_v2') THEN
    RETURN;
  END IF;

  ALTER TABLE studio_production_orders_v2 ENABLE ROW LEVEL SECURITY;
  ALTER TABLE studio_production_stages_v2 ENABLE ROW LEVEL SECURITY;
  ALTER TABLE studio_stage_assignments_v2 ENABLE ROW LEVEL SECURITY;
  ALTER TABLE studio_stage_receipts_v2 ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "Company users can manage studio production orders v2" ON studio_production_orders_v2;
  CREATE POLICY "Company users can manage studio production orders v2"
    ON studio_production_orders_v2 FOR ALL TO authenticated
    USING (company_id = get_user_company_id())
    WITH CHECK (company_id = get_user_company_id());

  DROP POLICY IF EXISTS "Company users can manage studio production stages v2" ON studio_production_stages_v2;
  CREATE POLICY "Company users can manage studio production stages v2"
    ON studio_production_stages_v2 FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM studio_production_orders_v2 o
        WHERE o.id = studio_production_stages_v2.order_id AND o.company_id = get_user_company_id()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM studio_production_orders_v2 o
        WHERE o.id = studio_production_stages_v2.order_id AND o.company_id = get_user_company_id()
      )
    );

  DROP POLICY IF EXISTS "Company users can manage studio stage assignments v2" ON studio_stage_assignments_v2;
  CREATE POLICY "Company users can manage studio stage assignments v2"
    ON studio_stage_assignments_v2 FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM studio_production_stages_v2 s
        JOIN studio_production_orders_v2 o ON o.id = s.order_id
        WHERE s.id = studio_stage_assignments_v2.stage_id AND o.company_id = get_user_company_id()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM studio_production_stages_v2 s
        JOIN studio_production_orders_v2 o ON o.id = s.order_id
        WHERE s.id = studio_stage_assignments_v2.stage_id AND o.company_id = get_user_company_id()
      )
    );

  DROP POLICY IF EXISTS "Company users can manage studio stage receipts v2" ON studio_stage_receipts_v2;
  CREATE POLICY "Company users can manage studio stage receipts v2"
    ON studio_stage_receipts_v2 FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM studio_production_stages_v2 s
        JOIN studio_production_orders_v2 o ON o.id = s.order_id
        WHERE s.id = studio_stage_receipts_v2.stage_id AND o.company_id = get_user_company_id()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM studio_production_stages_v2 s
        JOIN studio_production_orders_v2 o ON o.id = s.order_id
        WHERE s.id = studio_stage_receipts_v2.stage_id AND o.company_id = get_user_company_id()
      )
    );
END $$;
