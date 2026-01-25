-- ============================================================================
-- FIX TRIGGERS & ACCOUNT BALANCES
-- ============================================================================

-- Step 1: Fix sale totals update trigger (separate for INSERT/UPDATE/DELETE)
CREATE OR REPLACE FUNCTION update_sale_payment_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_total_paid NUMERIC;
  v_sale_total NUMERIC;
  v_sale_id UUID;
BEGIN
  -- Determine sale_id based on trigger operation
  IF TG_OP = 'DELETE' THEN
    v_sale_id := OLD.reference_id;
  ELSE
    v_sale_id := NEW.reference_id;
  END IF;
  
  -- Only process if reference_type is 'sale'
  IF (TG_OP = 'DELETE' AND OLD.reference_type = 'sale') OR 
     (TG_OP != 'DELETE' AND NEW.reference_type = 'sale') THEN
    
    -- Calculate total paid from all payments for this sale
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total_paid
    FROM payments
    WHERE reference_type = 'sale'
      AND reference_id = v_sale_id;
    
    -- Get sale total
    SELECT total INTO v_sale_total
    FROM sales
    WHERE id = v_sale_id;
    
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
    WHERE id = v_sale_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create separate triggers for INSERT, UPDATE, DELETE
DROP TRIGGER IF EXISTS trigger_update_sale_totals_insert ON payments;
CREATE TRIGGER trigger_update_sale_totals_insert
AFTER INSERT ON payments
FOR EACH ROW
WHEN (NEW.reference_type = 'sale')
EXECUTE FUNCTION update_sale_payment_totals();

DROP TRIGGER IF EXISTS trigger_update_sale_totals_update ON payments;
CREATE TRIGGER trigger_update_sale_totals_update
AFTER UPDATE ON payments
FOR EACH ROW
WHEN (NEW.reference_type = 'sale')
EXECUTE FUNCTION update_sale_payment_totals();

DROP TRIGGER IF EXISTS trigger_update_sale_totals_delete ON payments;
CREATE TRIGGER trigger_update_sale_totals_delete
AFTER DELETE ON payments
FOR EACH ROW
WHEN (OLD.reference_type = 'sale')
EXECUTE FUNCTION update_sale_payment_totals();

-- Step 3: Ensure account balance trigger is working
-- (Already created in FIX_CORE_ACCOUNTING.sql, just verify)
SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_update_account_balance';

-- Step 4: Recalculate all account balances from journal entries
UPDATE accounts a
SET balance = COALESCE((
  SELECT SUM(jel.debit - jel.credit)
  FROM journal_entry_lines jel
  WHERE jel.account_id = a.id
), 0);

-- Step 5: Update reference numbers to sequential format
-- First, reset sequence for each company
DO $$
DECLARE
  company_record RECORD;
  v_max_seq INTEGER;
BEGIN
  FOR company_record IN SELECT DISTINCT company_id FROM payments
  LOOP
    -- Get max sequence for this company
    SELECT COALESCE(MAX(
      CAST(SUBSTRING(reference_number FROM '[0-9]+$') AS INTEGER)
    ), 0)
    INTO v_max_seq
    FROM payments
    WHERE company_id = company_record.company_id
      AND reference_number ~ '^PAY-[0-9]{4}-[0-9]+$';
    
    -- Update all payments for this company with sequential numbers
    UPDATE payments p
    SET reference_number = 'PAY-' || TO_CHAR(NOW(), 'YYYY') || '-' || 
      LPAD((ROW_NUMBER() OVER (ORDER BY created_at) + v_max_seq)::TEXT, 4, '0')
    WHERE p.company_id = company_record.company_id
      AND (p.reference_number LIKE 'PAY-%' AND p.reference_number !~ '^PAY-[0-9]{4}-[0-9]+$')
      AND p.reference_type = 'sale';
  END LOOP;
END $$;

-- Verification
SELECT 
  'Sales Totals Updated' as check_name,
  COUNT(*) as count
FROM sales s
WHERE ABS(s.paid_amount - COALESCE((
  SELECT SUM(p.amount) FROM payments p 
  WHERE p.reference_type = 'sale' AND p.reference_id = s.id
), 0)) < 0.01
UNION ALL
SELECT 
  'Account Balances Updated',
  COUNT(*)
FROM accounts
WHERE balance != 0;
