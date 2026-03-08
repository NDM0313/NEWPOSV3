-- ============================================================================
-- STUDIO PRODUCTION V2 – RLS (Safe Zone)
-- ============================================================================
-- Run after: studio_production_v2_tables.sql, feature_flags_table.sql
-- Company-scoped access: users see only their company's V2 data.
-- ============================================================================

ALTER TABLE studio_production_orders_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_production_stages_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_stage_assignments_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_stage_receipts_v2 ENABLE ROW LEVEL SECURITY;

-- Orders: SELECT/INSERT/UPDATE/DELETE by company
DROP POLICY IF EXISTS "Company users can manage studio production orders v2" ON studio_production_orders_v2;
CREATE POLICY "Company users can manage studio production orders v2"
  ON studio_production_orders_v2 FOR ALL TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

-- Stages: access via order's company (join through order_id)
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

-- Assignments: access via stage → order → company
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

-- Receipts: access via stage → order → company
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
