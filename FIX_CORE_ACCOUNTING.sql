-- ============================================================================
-- FIX CORE ACCOUNTING FLOW
-- ============================================================================

-- Step 1: Ensure default accounts exist for all companies
DO $$
DECLARE
  company_record RECORD;
BEGIN
  FOR company_record IN SELECT id FROM companies
  LOOP
    -- Cash Account (1000)
    INSERT INTO accounts (company_id, code, name, type, balance, is_active)
    VALUES (company_record.id, '1000', 'Cash', 'asset', 0, true)
    ON CONFLICT DO NOTHING;
    
    -- Bank Account (1010)
    INSERT INTO accounts (company_id, code, name, type, balance, is_active)
    VALUES (company_record.id, '1010', 'Bank', 'asset', 0, true)
    ON CONFLICT DO NOTHING;
    
    -- Capital/Equity Account (3000)
    INSERT INTO accounts (company_id, code, name, type, balance, is_active)
    VALUES (company_record.id, '3000', 'Capital', 'equity', 0, true)
    ON CONFLICT DO NOTHING;
    
    -- Accounts Receivable (2000)
    INSERT INTO accounts (company_id, code, name, type, balance, is_active)
    VALUES (company_record.id, '2000', 'Accounts Receivable', 'asset', 0, true)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- Step 2: Create function to update account balance from journal entries
CREATE OR REPLACE FUNCTION update_account_balance_from_journal()
RETURNS TRIGGER AS $$
BEGIN
  -- Update balance for debit account
  IF NEW.debit > 0 THEN
    UPDATE accounts
    SET balance = balance + NEW.debit
    WHERE id = NEW.account_id;
  END IF;
  
  -- Update balance for credit account
  IF NEW.credit > 0 THEN
    UPDATE accounts
    SET balance = balance - NEW.credit
    WHERE id = NEW.account_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create trigger to auto-update account balances
DROP TRIGGER IF EXISTS trigger_update_account_balance ON journal_entry_lines;
CREATE TRIGGER trigger_update_account_balance
AFTER INSERT ON journal_entry_lines
FOR EACH ROW
EXECUTE FUNCTION update_account_balance_from_journal();

-- Step 4: Backfill account balances from existing journal entries
UPDATE accounts a
SET balance = COALESCE((
  SELECT 
    SUM(CASE WHEN jel.debit > 0 THEN jel.debit ELSE 0 END) - 
    SUM(CASE WHEN jel.credit > 0 THEN jel.credit ELSE 0 END)
  FROM journal_entry_lines jel
  WHERE jel.account_id = a.id
), 0);

-- Step 5: Create function to record initial payment when sale is created
CREATE OR REPLACE FUNCTION record_initial_sale_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_account_id UUID;
  v_payment_method VARCHAR(50);
  v_reference_number VARCHAR(100);
BEGIN
  -- Only process if sale has initial payment
  IF NEW.paid_amount > 0 AND NEW.payment_method IS NOT NULL THEN
    -- Get default account based on payment method
    SELECT id INTO v_account_id
    FROM accounts
    WHERE company_id = NEW.company_id
      AND (
        (NEW.payment_method = 'cash' AND code = '1000') OR
        (NEW.payment_method = 'bank' AND code = '1010') OR
        (NEW.payment_method = 'card' AND code = '1010')
      )
    LIMIT 1;
    
    -- If no account found, use Cash as default
    IF v_account_id IS NULL THEN
      SELECT id INTO v_account_id
      FROM accounts
      WHERE company_id = NEW.company_id AND code = '1000'
      LIMIT 1;
    END IF;
    
    -- Only record if account found and payment doesn't already exist
    IF v_account_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM payments 
      WHERE reference_type = 'sale' 
        AND reference_id = NEW.id
        AND amount = NEW.paid_amount
    ) THEN
      -- Generate reference number
      v_reference_number := 'PAY-' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS') || '-' || SUBSTRING(NEW.id::TEXT, 1, 8);
      
      -- Normalize payment method
      v_payment_method := CASE 
        WHEN LOWER(NEW.payment_method) IN ('cash') THEN 'cash'
        WHEN LOWER(NEW.payment_method) IN ('bank', 'card', 'cheque') THEN 'bank'
        ELSE 'cash'
      END;
      
      -- Insert payment record
      INSERT INTO payments (
        company_id,
        branch_id,
        payment_type,
        reference_type,
        reference_id,
        amount,
        payment_method,
        payment_date,
        payment_account_id,
        reference_number,
        created_by
      ) VALUES (
        NEW.company_id,
        NEW.branch_id,
        'received',
        'sale',
        NEW.id,
        NEW.paid_amount,
        v_payment_method,
        NEW.invoice_date,
        v_account_id,
        v_reference_number,
        NEW.created_by
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create trigger to record initial payment
DROP TRIGGER IF EXISTS trigger_record_initial_payment ON sales;
CREATE TRIGGER trigger_record_initial_payment
AFTER INSERT ON sales
FOR EACH ROW
WHEN (NEW.paid_amount > 0)
EXECUTE FUNCTION record_initial_sale_payment();

-- Step 7: Backfill missing initial payments for existing sales
INSERT INTO payments (
  company_id,
  branch_id,
  payment_type,
  reference_type,
  reference_id,
  amount,
  payment_method,
  payment_date,
  payment_account_id,
  reference_number
)
SELECT 
  s.company_id,
  s.branch_id,
  'received',
  'sale',
  s.id,
  s.paid_amount,
  CASE 
    WHEN LOWER(COALESCE(s.payment_method, 'cash')) IN ('cash') THEN 'cash'
    WHEN LOWER(COALESCE(s.payment_method, 'cash')) IN ('bank', 'card', 'cheque') THEN 'bank'
    ELSE 'cash'
  END,
  s.invoice_date,
  COALESCE(
    (SELECT id FROM accounts 
     WHERE company_id = s.company_id 
       AND (
         (LOWER(COALESCE(s.payment_method, 'cash')) = 'cash' AND code = '1000') OR
         (LOWER(COALESCE(s.payment_method, 'cash')) IN ('bank', 'card') AND code = '1010')
       )
     LIMIT 1),
    (SELECT id FROM accounts WHERE company_id = s.company_id AND code = '1000' LIMIT 1)
  ),
  'PAY-INIT-' || s.invoice_no || '-' || SUBSTRING(s.id::TEXT, 1, 8)
FROM sales s
WHERE s.paid_amount > 0
  AND NOT EXISTS (
    SELECT 1 FROM payments p
    WHERE p.reference_type = 'sale'
      AND p.reference_id = s.id
      AND ABS(p.amount - s.paid_amount) < 0.01
  );

-- Verification
SELECT 'Default Accounts' as check_name, COUNT(*) as count 
FROM accounts WHERE code IN ('1000', '1010', '2000', '3000')
UNION ALL
SELECT 'Account Balances Updated', COUNT(*) 
FROM accounts WHERE balance != 0
UNION ALL
SELECT 'Initial Payments Backfilled', COUNT(*) 
FROM payments WHERE reference_number LIKE 'PAY-INIT-%';
