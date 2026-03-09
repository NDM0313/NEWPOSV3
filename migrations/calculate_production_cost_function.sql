-- ============================================================================
-- Production cost calculation function (no trigger / no inventory change)
-- ============================================================================
-- Recomputes actual_cost = SUM(stage.cost) + fabric cost. Call from app after
-- stage cost edits. Does NOT modify inventory or accounting triggers.
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_production_cost(p_production_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prod RECORD;
  v_stage_cost NUMERIC := 0;
  v_fabric_cost NUMERIC := 0;
  v_total NUMERIC := 0;
BEGIN
  SELECT id, company_id, branch_id, sale_id, product_id, quantity
  INTO v_prod
  FROM studio_productions
  WHERE id = p_production_id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Worker stage costs (studio_production_stages.cost)
  SELECT COALESCE(SUM(COALESCE(cost, 0)), 0) INTO v_stage_cost
  FROM studio_production_stages
  WHERE production_id = p_production_id;

  -- Fabric cost from related sale: sales_items (primary) or sale_items (legacy)
  IF v_prod.sale_id IS NOT NULL AND v_prod.product_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sales_items') THEN
      SELECT COALESCE(SUM(COALESCE(unit_price, 0) * COALESCE(quantity, 1)), 0) INTO v_fabric_cost
      FROM sales_items
      WHERE sale_id = v_prod.sale_id AND product_id = v_prod.product_id;
    END IF;
    IF v_fabric_cost = 0 AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sale_items') THEN
      SELECT COALESCE(SUM(COALESCE(unit_price, price, 0) * COALESCE(quantity, 1)), 0) INTO v_fabric_cost
      FROM sale_items
      WHERE sale_id = v_prod.sale_id AND product_id = v_prod.product_id;
    END IF;
  END IF;

  v_total := v_stage_cost + v_fabric_cost;
  IF v_total < 0 THEN v_total := 0; END IF;

  UPDATE studio_productions
  SET actual_cost = v_total, updated_at = NOW()
  WHERE id = p_production_id;

  RETURN v_total;
END;
$$;

COMMENT ON FUNCTION calculate_production_cost(UUID) IS 'Production cost = SUM(studio_production_stages.cost) + fabric from sales_items/sale_items. Updates actual_cost. Call from app after stage cost edits.';
