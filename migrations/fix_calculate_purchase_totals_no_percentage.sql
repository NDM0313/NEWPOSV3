-- Fix: calculate_purchase_totals trigger must not reference discount_percentage/tax_percentage
-- (those columns may be dropped or not exist; only discount_amount/tax_amount are used)
-- Trigger runs on purchase_items; updates the parent purchase row.

CREATE OR REPLACE FUNCTION calculate_purchase_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_subtotal DECIMAL(15,2);
  v_purchase_id UUID;
BEGIN
  v_purchase_id := NEW.purchase_id;

  SELECT COALESCE(SUM(total), 0)
  INTO v_subtotal
  FROM purchase_items
  WHERE purchase_id = v_purchase_id;

  -- Preserve existing discount_amount/tax_amount (no discount_percentage/tax_percentage columns)
  UPDATE purchases SET
    subtotal = v_subtotal,
    total = v_subtotal - COALESCE(discount_amount, 0) + COALESCE(tax_amount, 0) + COALESCE(shipping_cost, 0),
    due_amount = (v_subtotal - COALESCE(discount_amount, 0) + COALESCE(tax_amount, 0) + COALESCE(shipping_cost, 0)) - COALESCE(paid_amount, 0),
    payment_status = CASE
      WHEN COALESCE(paid_amount, 0) = 0 THEN 'unpaid'::payment_status
      WHEN COALESCE(paid_amount, 0) >= (v_subtotal - COALESCE(discount_amount, 0) + COALESCE(tax_amount, 0) + COALESCE(shipping_cost, 0)) THEN 'paid'::payment_status
      ELSE 'partial'::payment_status
    END
  WHERE id = v_purchase_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger should already exist; ensure it uses the updated function
DROP TRIGGER IF EXISTS trigger_calculate_purchase_totals ON purchase_items;
CREATE TRIGGER trigger_calculate_purchase_totals
  AFTER INSERT OR UPDATE ON purchase_items
  FOR EACH ROW
  EXECUTE PROCEDURE calculate_purchase_totals();
