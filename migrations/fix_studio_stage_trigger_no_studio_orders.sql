-- ============================================================================
-- FIX: "relation studio_orders does not exist" when INSERT into studio_production_stages
-- ============================================================================
-- The trigger on studio_production_stages calls sync_sale_studio_charges_for_sale()
-- which calls get_sale_studio_charges(). The DB had OLD versions of these that
-- reference studio_orders (from studio_sales_integration_full.sql). This migration
-- replaces them so the trigger chain never touches studio_orders.
-- Run in Supabase SQL Editor.
-- ============================================================================

-- 1. get_sale_studio_charges: ONLY studio_production_stages + studio_productions (no studio_orders, no studio_tasks)
CREATE OR REPLACE FUNCTION get_sale_studio_charges(p_sale_id UUID)
RETURNS NUMERIC(15,2)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(SUM(s.cost), 0)::NUMERIC(15,2)
  FROM studio_production_stages s
  INNER JOIN studio_productions p ON p.id = s.production_id
  WHERE p.sale_id = p_sale_id;
$$;

-- 2. sync_sale_studio_charges_for_sale: recalc studio_charges and due_amount; do NOT reference studio_orders in status update
CREATE OR REPLACE FUNCTION sync_sale_studio_charges_for_sale(p_sale_id UUID)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_studio_charges NUMERIC(15,2);
  v_total NUMERIC(15,2);
  v_paid NUMERIC(15,2);
  v_due NUMERIC(15,2);
BEGIN
  IF p_sale_id IS NULL THEN RETURN; END IF;

  v_studio_charges := get_sale_studio_charges(p_sale_id);

  SELECT total, paid_amount INTO v_total, v_paid
  FROM sales WHERE id = p_sale_id;

  IF NOT FOUND THEN RETURN; END IF;

  v_total := COALESCE(v_total, 0);
  v_paid := COALESCE(v_paid, 0);
  v_due := GREATEST(0, (v_total + v_studio_charges) - v_paid);

  UPDATE sales
  SET studio_charges = v_studio_charges,
      due_amount = v_due,
      updated_at = NOW()
  WHERE id = p_sale_id;
END;
$$;

-- 3. Drop trigger that creates studio_orders when a production is created (table dropped)
DROP TRIGGER IF EXISTS trigger_ensure_studio_order_on_production ON studio_productions;

-- 4. Optionally drop the old function that inserted into studio_orders (so nothing can call it)
DROP FUNCTION IF EXISTS ensure_studio_order_for_sale();

COMMENT ON FUNCTION get_sale_studio_charges(UUID) IS 'Sum of stage costs for productions linked to sale. Used by sync trigger. No studio_orders.';
COMMENT ON FUNCTION sync_sale_studio_charges_for_sale(UUID) IS 'Recalc sales.studio_charges and due_amount. No studio_orders.';
