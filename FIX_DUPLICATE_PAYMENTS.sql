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

-- Step 4: Create sequential reference number function (atomic, one sequence per company per year)
-- Constraint is (company_id, reference_number) so numbers must be unique per company, NOT per reference_type.
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
  v_lock BIGINT;
BEGIN
  -- Serialize per company so concurrent inserts get different sequence numbers
  v_lock := hashtext(p_company_id::text);
  PERFORM pg_advisory_xact_lock(v_lock);

  -- Next number for this company+year (all payment types share the same sequence)
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(reference_number FROM '[0-9]+$') AS INTEGER)
  ), 0) + 1
  INTO v_sequence
  FROM payments
  WHERE company_id = p_company_id
    AND reference_number ~ ('^' || v_prefix || '-' || v_year || '-[0-9]+$');
  
  v_reference := v_prefix || '-' || v_year || '-' || LPAD(v_sequence::TEXT, 4, '0');
  RETURN v_reference;
END;
$$ LANGUAGE plpgsql;

-- Step 4b: Fix existing duplicate reference_numbers (reassign so each row is unique per company)
DO $$
DECLARE
  r RECORD;
  keep_id UUID;
BEGIN
  FOR r IN
    SELECT p.id, p.company_id, p.reference_type, p.reference_number
    FROM payments p
    JOIN (
      SELECT company_id, reference_number
      FROM payments
      WHERE reference_number IS NOT NULL AND reference_number <> ''
      GROUP BY company_id, reference_number
      HAVING COUNT(*) > 1
    ) d ON d.company_id = p.company_id AND d.reference_number = p.reference_number
  LOOP
    -- Keep one row per (company_id, reference_number): first by id (no MIN(uuid), use ORDER BY id LIMIT 1)
    SELECT p2.id INTO keep_id
    FROM payments p2
    WHERE p2.company_id = r.company_id AND p2.reference_number = r.reference_number
    ORDER BY p2.id
    LIMIT 1;
    IF r.id = keep_id THEN
      CONTINUE;  -- keep this row, skip update
    END IF;
    UPDATE payments
    SET reference_number = generate_payment_reference(r.company_id, r.reference_type)
    WHERE id = r.id;
  END LOOP;
END $$;

-- Step 5: Update existing payments with sequential references (non-duplicate rows only)
UPDATE payments p
SET reference_number = generate_payment_reference(p.company_id, p.reference_type)
WHERE reference_number LIKE 'PAY-%'
  AND (reference_number !~ '^PAY-[0-9]{4}-[0-9]+$' OR reference_number = 'PAY-INIT-%');

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
  -- Only run for sale-related payments (WHEN cannot reference OLD on INSERT)
  IF TG_OP = 'DELETE' THEN
    IF OLD.reference_type IS DISTINCT FROM 'sale' THEN RETURN OLD; END IF;
  ELSE
    IF NEW.reference_type IS DISTINCT FROM 'sale' THEN RETURN COALESCE(NEW, OLD); END IF;
  END IF;

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
-- (No WHEN clause: INSERT has no OLD, DELETE has no NEW. Filter inside function.)
DROP TRIGGER IF EXISTS trigger_update_sale_totals ON payments;
CREATE TRIGGER trigger_update_sale_totals
AFTER INSERT OR UPDATE OR DELETE ON payments
FOR EACH ROW
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
