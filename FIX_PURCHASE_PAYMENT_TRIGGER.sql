-- ============================================================================
-- FIX PURCHASE PAYMENT TOTALS TRIGGER
-- ============================================================================
-- This trigger automatically updates purchase paid_amount and due_amount
-- when payments are inserted, updated, or deleted

-- Step 1: Create function to update purchase payment totals
CREATE OR REPLACE FUNCTION update_purchase_payment_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_total_paid NUMERIC;
  v_purchase_total NUMERIC;
  v_purchase_id UUID;
BEGIN
  -- Determine purchase_id based on trigger operation
  IF TG_OP = 'DELETE' THEN
    v_purchase_id := OLD.reference_id;
  ELSE
    v_purchase_id := NEW.reference_id;
  END IF;
  
  -- Only process if reference_type is 'purchase'
  IF (TG_OP = 'DELETE' AND OLD.reference_type = 'purchase') OR 
     (TG_OP != 'DELETE' AND NEW.reference_type = 'purchase') THEN
    
    -- Calculate total paid from all payments for this purchase
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total_paid
    FROM payments
    WHERE reference_type = 'purchase'
      AND reference_id = v_purchase_id;
    
    -- Get purchase total
    SELECT total INTO v_purchase_total
    FROM purchases
    WHERE id = v_purchase_id;
    
    -- Update purchase
    UPDATE purchases
    SET 
      paid_amount = v_total_paid,
      due_amount = GREATEST(0, v_purchase_total - v_total_paid),
      payment_status = CASE
        WHEN v_total_paid >= v_purchase_total THEN 'paid'::payment_status
        WHEN v_total_paid > 0 THEN 'partial'::payment_status
        ELSE 'unpaid'::payment_status
      END
    WHERE id = v_purchase_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create separate triggers for INSERT, UPDATE, DELETE
DROP TRIGGER IF EXISTS trigger_update_purchase_totals_insert ON payments;
CREATE TRIGGER trigger_update_purchase_totals_insert
AFTER INSERT ON payments
FOR EACH ROW
WHEN (NEW.reference_type = 'purchase')
EXECUTE FUNCTION update_purchase_payment_totals();

DROP TRIGGER IF EXISTS trigger_update_purchase_totals_update ON payments;
CREATE TRIGGER trigger_update_purchase_totals_update
AFTER UPDATE ON payments
FOR EACH ROW
WHEN (NEW.reference_type = 'purchase')
EXECUTE FUNCTION update_purchase_payment_totals();

DROP TRIGGER IF EXISTS trigger_update_purchase_totals_delete ON payments;
CREATE TRIGGER trigger_update_purchase_totals_delete
AFTER DELETE ON payments
FOR EACH ROW
WHEN (OLD.reference_type = 'purchase')
EXECUTE FUNCTION update_purchase_payment_totals();

-- Step 3: Recalculate all purchase payment totals (backfill existing data)
UPDATE purchases p
SET 
  paid_amount = COALESCE((
    SELECT SUM(amount)
    FROM payments
    WHERE reference_type = 'purchase'
      AND reference_id = p.id
  ), 0),
  due_amount = GREATEST(0, total - COALESCE((
    SELECT SUM(amount)
    FROM payments
    WHERE reference_type = 'purchase'
      AND reference_id = p.id
  ), 0)),
  payment_status = CASE
    WHEN COALESCE((
      SELECT SUM(amount)
      FROM payments
      WHERE reference_type = 'purchase'
        AND reference_id = p.id
    ), 0) >= total THEN 'paid'::payment_status
    WHEN COALESCE((
      SELECT SUM(amount)
      FROM payments
      WHERE reference_type = 'purchase'
        AND reference_id = p.id
    ), 0) > 0 THEN 'partial'::payment_status
    ELSE 'unpaid'::payment_status
  END;

-- Verification
SELECT 
  'Purchase Totals Updated' as check_name,
  COUNT(*) as count
FROM purchases p
WHERE ABS(p.paid_amount - COALESCE((
  SELECT SUM(amount) FROM payments 
  WHERE reference_type = 'purchase' AND reference_id = p.id
), 0)) < 0.01;
