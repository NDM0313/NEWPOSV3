-- Fix: payment_status column is type payment_status (enum); CASE expression must be cast.
-- Use when you see: column "payment_status" is of type payment_status but expression is of type text
-- If the error comes from record_payment_with_accounting RPC, update that RPC to use (CASE ... END)::payment_status for purchases (and sales if needed).

-- Ensure update_purchase_payment_totals trigger function uses ::payment_status
CREATE OR REPLACE FUNCTION update_purchase_payment_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_total_paid NUMERIC;
  v_purchase_total NUMERIC;
  v_purchase_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_purchase_id := OLD.reference_id;
  ELSE
    v_purchase_id := NEW.reference_id;
  END IF;

  IF (TG_OP = 'DELETE' AND OLD.reference_type = 'purchase') OR
     (TG_OP != 'DELETE' AND NEW.reference_type = 'purchase') THEN

    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
    FROM payments
    WHERE reference_type = 'purchase' AND reference_id = v_purchase_id;

    SELECT total INTO v_purchase_total FROM purchases WHERE id = v_purchase_id;

    UPDATE purchases
    SET
      paid_amount = v_total_paid,
      due_amount = GREATEST(0, v_purchase_total - v_total_paid),
      payment_status = (CASE
        WHEN v_total_paid >= v_purchase_total THEN 'paid'
        WHEN v_total_paid > 0 THEN 'partial'
        ELSE 'unpaid'
      END)::payment_status
    WHERE id = v_purchase_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
