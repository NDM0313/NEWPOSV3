-- ============================================================================
-- FIX DUPLICATE PAYMENTS & ACCOUNTING INTEGRITY
-- ============================================================================

-- Step 1: Remove duplicate payments (keep only one per sale with same amount)
-- Delete duplicates, keeping the oldest one
DELETE FROM payments p1
WHERE EXISTS (
  SELECT 1 FROM payments p2
  WHERE p2.reference_type = p1.reference_type
    AND p2.reference_id = p1.reference_id
    AND ABS(p2.amount - p1.amount) < 0.01
    AND p2.id < p1.id  -- Keep older payment
    AND p2.payment_date = p1.payment_date
);

-- Step 2: Recalculate sale paid_amount from actual payments
UPDATE sales s
SET paid_amount = COALESCE((
  SELECT SUM(p.amount)
  FROM payments p
  WHERE p.reference_type = 'sale'
    AND p.reference_id = s.id
), 0),
due_amount = s.total - COALESCE((
  SELECT SUM(p.amount)
  FROM payments p
  WHERE p.reference_type = 'sale'
    AND p.reference_id = s.id
), 0),
payment_status = CASE
  WHEN COALESCE((
    SELECT SUM(p.amount)
    FROM payments p
    WHERE p.reference_type = 'sale'
      AND p.reference_id = s.id
  ), 0) >= s.total THEN 'paid'::payment_status
  WHEN COALESCE((
    SELECT SUM(p.amount)
    FROM payments p
    WHERE p.reference_type = 'sale'
      AND p.reference_id = s.id
  ), 0) > 0 THEN 'partial'::payment_status
  ELSE 'unpaid'::payment_status
END;

-- Step 3: Disable trigger temporarily to prevent auto-inserts
ALTER TABLE sales DISABLE TRIGGER trigger_record_initial_payment;

-- Step 4: Create sequential reference number function
CREATE OR REPLACE FUNCTION generate_payment_reference(
  p_company_id UUID,
  p_reference_type VARCHAR DEFAULT 'sale'
)
RETURNS VARCHAR AS $$
DECLARE
  v_prefix VARCHAR := 'PAY';
  v_year VARCHAR := TO_CHAR(NOW(), 'YYYY');
  v_sequence INTEGER;
  v_reference VARCHAR;
BEGIN
  -- Get next sequence number for this company and year
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(reference_number FROM '[0-9]+$') AS INTEGER)
  ), 0) + 1
  INTO v_sequence
  FROM payments
  WHERE company_id = p_company_id
    AND reference_number LIKE v_prefix || '-' || v_year || '-%'
    AND reference_type = p_reference_type;
  
  -- Format: PAY-2026-0001, PAY-2026-0002, etc.
  v_reference := v_prefix || '-' || v_year || '-' || LPAD(v_sequence::TEXT, 4, '0');
  
  RETURN v_reference;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Update existing payments with sequential references
UPDATE payments p
SET reference_number = generate_payment_reference(p.company_id, p.reference_type)
WHERE reference_number LIKE 'PAY-%' 
  AND (reference_number LIKE 'PAY-[0-9]%' OR reference_number LIKE 'PAY-INIT-%');

-- Step 6: Create trigger to auto-generate sequential reference if missing
CREATE OR REPLACE FUNCTION set_payment_reference()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reference_number IS NULL OR NEW.reference_number = '' THEN
    NEW.reference_number := generate_payment_reference(NEW.company_id, NEW.reference_type);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_payment_reference ON payments;
CREATE TRIGGER trigger_set_payment_reference
BEFORE INSERT ON payments
FOR EACH ROW
EXECUTE FUNCTION set_payment_reference();

-- Step 7: Create function to update sale paid/due amounts from payments
CREATE OR REPLACE FUNCTION update_sale_payment_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_total_paid NUMERIC;
  v_sale_total NUMERIC;
BEGIN
  -- Calculate total paid from all payments for this sale
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_paid
  FROM payments
  WHERE reference_type = 'sale'
    AND reference_id = COALESCE(NEW.reference_id, OLD.reference_id);
  
  -- Get sale total
  SELECT total INTO v_sale_total
  FROM sales
  WHERE id = COALESCE(NEW.reference_id, OLD.reference_id);
  
  -- Update sale
  UPDATE sales
  SET 
    paid_amount = v_total_paid,
    due_amount = v_sale_total - v_total_paid,
    payment_status = CASE
      WHEN v_total_paid >= v_sale_total THEN 'paid'::payment_status
      WHEN v_total_paid > 0 THEN 'partial'::payment_status
      ELSE 'unpaid'::payment_status
    END
  WHERE id = COALESCE(NEW.reference_id, OLD.reference_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Step 8: Create trigger to auto-update sale totals when payment changes
DROP TRIGGER IF EXISTS trigger_update_sale_totals ON payments;
CREATE TRIGGER trigger_update_sale_totals
AFTER INSERT OR UPDATE OR DELETE ON payments
FOR EACH ROW
WHEN (OLD.reference_type = 'sale' OR NEW.reference_type = 'sale')
EXECUTE FUNCTION update_sale_payment_totals();

-- Verification
SELECT 
  'Duplicate Payments Removed' as check_name,
  COUNT(*) as remaining_payments
FROM payments
WHERE reference_type = 'sale'
UNION ALL
SELECT 
  'Sales with Correct Paid Amount',
  COUNT(*)
FROM sales s
WHERE ABS(s.paid_amount - COALESCE((
  SELECT SUM(p.amount) FROM payments p 
  WHERE p.reference_type = 'sale' AND p.reference_id = s.id
), 0)) < 0.01;
