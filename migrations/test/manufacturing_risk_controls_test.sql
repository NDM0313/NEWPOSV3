-- ============================================================================
-- TEST ONLY — STEP 8: Risk controls (safeguards)
-- ============================================================================
-- 1) Prevent duplicate stock movements (by reference_type, reference_id, movement_type)
-- 2) Prevent duplicate accounting entries (idempotent triggers already)
-- 3) Validate production before invoice generation (function for app to call)
-- 4) Optional: prevent negative stock (check before SALE movement) - warn only in test
-- Do not block existing flows; add checks where safe.
-- ============================================================================

-- 1) Unique partial index: one PRODUCTION movement per studio_production
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_movements_studio_production_unique_test
  ON stock_movements (reference_id)
  WHERE reference_type = 'studio_production' AND movement_type = 'PRODUCTION';

-- 2) Function: validate production before allowing Generate Invoice (app can call)
CREATE OR REPLACE FUNCTION validate_production_before_invoice_test(p_production_id UUID)
RETURNS TABLE(ok boolean, message text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prod RECORD;
  v_stage_count INT;
BEGIN
  SELECT id, status, sale_id, product_id INTO v_prod FROM studio_productions WHERE id = p_production_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Production not found'::text;
    RETURN;
  END IF;
  IF v_prod.sale_id IS NULL THEN
    RETURN QUERY SELECT false, 'Production must be linked to a sale'::text;
    RETURN;
  END IF;
  SELECT COUNT(*) INTO v_stage_count FROM studio_production_stages WHERE production_id = p_production_id;
  IF v_stage_count = 0 THEN
    RETURN QUERY SELECT false, 'Add at least one production stage (Customize Tasks)'::text;
    RETURN;
  END IF;
  RETURN QUERY SELECT true, 'OK'::text;
END;
$$;

-- 3) Function: check if sale can be finalized (inventory exists for all lines)
CREATE OR REPLACE FUNCTION can_finalize_sale_inventory_check_test(p_sale_id UUID)
RETURNS TABLE(ok boolean, message text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_missing INT;
BEGIN
  -- Check: for each product in sales_items, we have at least that quantity in stock (sum of positive movements)
  -- Simplified: just return true; full check would aggregate stock per product and compare to sale lines
  RETURN QUERY SELECT true, 'OK'::text;
END;
$$;

COMMENT ON FUNCTION validate_production_before_invoice_test(UUID) IS 'TEST: Validate production before Generate Invoice.';
COMMENT ON FUNCTION can_finalize_sale_inventory_check_test(UUID) IS 'TEST: Placeholder for sale final inventory check.';
