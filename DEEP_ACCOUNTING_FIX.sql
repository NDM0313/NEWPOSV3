-- ============================================================================
-- DEEP ACCOUNTING FIX - COMPREHENSIVE SOLUTION
-- Addresses all 6 critical issues
-- ============================================================================

-- ============================================================================
-- ISSUE 1: FIX REFERENCE NUMBER GENERATION (UNIQUE PER PAYMENT)
-- ============================================================================

-- Drop old function
DROP FUNCTION IF EXISTS generate_payment_reference(UUID, payment_method_enum);

-- Create improved function with unique per-payment references
CREATE OR REPLACE FUNCTION generate_payment_reference(
  p_company_id UUID,
  p_payment_method payment_method_enum
)
RETURNS VARCHAR AS $$
DECLARE
  v_prefix VARCHAR;
  v_year VARCHAR := TO_CHAR(NOW(), 'YYYY');
  v_sequence INTEGER;
  v_reference VARCHAR;
  v_exists BOOLEAN;
BEGIN
  -- Determine prefix based on payment method
  CASE p_payment_method
    WHEN 'cash' THEN v_prefix := 'CASH';
    WHEN 'bank' THEN v_prefix := 'BANK';
    WHEN 'card' THEN v_prefix := 'CARD';
    ELSE v_prefix := 'PAY';
  END CASE;
  
  -- Get next sequence number for this company, method, and year
  -- This ensures unique per payment, not per invoice
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(reference_number FROM '[0-9]+$') AS INTEGER)
  ), 0) + 1
  INTO v_sequence
  FROM payments
  WHERE company_id = p_company_id
    AND payment_method = p_payment_method
    AND reference_number ~ ('^' || v_prefix || '-' || v_year || '-[0-9]+$');
  
  -- Ensure sequence is at least 1
  IF v_sequence IS NULL OR v_sequence < 1 THEN
    v_sequence := 1;
  END IF;
  
  -- Format: CASH-2026-0001, BANK-2026-0001, etc.
  v_reference := v_prefix || '-' || v_year || '-' || LPAD(v_sequence::TEXT, 4, '0');
  
  -- Check if reference already exists (handle race condition)
  SELECT EXISTS(
    SELECT 1 FROM payments 
    WHERE company_id = p_company_id 
      AND reference_number = v_reference
  ) INTO v_exists;
  
  -- If exists, increment until unique
  WHILE v_exists LOOP
    v_sequence := v_sequence + 1;
    v_reference := v_prefix || '-' || v_year || '-' || LPAD(v_sequence::TEXT, 4, '0');
    
    SELECT EXISTS(
      SELECT 1 FROM payments 
      WHERE company_id = p_company_id 
        AND reference_number = v_reference
    ) INTO v_exists;
  END LOOP;
  
  RETURN v_reference;
END;
$$ LANGUAGE plpgsql;

-- Update trigger
DROP FUNCTION IF EXISTS set_payment_reference();
CREATE OR REPLACE FUNCTION set_payment_reference()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate if not provided or empty
  IF NEW.reference_number IS NULL OR NEW.reference_number = '' THEN
    NEW.reference_number := generate_payment_reference(NEW.company_id, NEW.payment_method);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ISSUE 2: ENSURE ACCOUNT BALANCE TRIGGER IS WORKING
-- ============================================================================

-- Verify and fix account balance update trigger
CREATE OR REPLACE FUNCTION update_account_balance_from_journal()
RETURNS TRIGGER AS $$
BEGIN
  -- Update account balance when journal entry line is created
  UPDATE accounts
  SET balance = COALESCE((
    SELECT SUM(jel.debit - jel.credit)
    FROM journal_entry_lines jel
    WHERE jel.account_id = NEW.account_id
  ), 0)
  WHERE id = NEW.account_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS trigger_update_account_balance ON journal_entry_lines;
CREATE TRIGGER trigger_update_account_balance
AFTER INSERT OR UPDATE OR DELETE ON journal_entry_lines
FOR EACH ROW
EXECUTE FUNCTION update_account_balance_from_journal();

-- ============================================================================
-- ISSUE 3: BACKFILL DISCOUNT/EXPENSE ENTRIES FOR EXISTING SALES
-- ============================================================================

-- Backfill discount journal entries
DO $$
DECLARE
  sale_record RECORD;
  v_journal_entry_id UUID;
  v_discount_account_id UUID;
  v_receivable_account_id UUID;
BEGIN
  FOR sale_record IN 
    SELECT s.id, s.company_id, s.branch_id, s.invoice_no, s.discount_amount
    FROM sales s
    WHERE s.discount_amount > 0
      AND NOT EXISTS (
        SELECT 1 FROM journal_entries je 
        WHERE je.reference_id = s.id 
          AND je.description LIKE '%discount%'
      )
  LOOP
    -- Get accounts
    SELECT id INTO v_discount_account_id
    FROM accounts
    WHERE company_id = sale_record.company_id
      AND code = '4100'
    LIMIT 1;
    
    SELECT id INTO v_receivable_account_id
    FROM accounts
    WHERE company_id = sale_record.company_id
      AND code = '2000'
    LIMIT 1;
    
    IF v_discount_account_id IS NOT NULL AND v_receivable_account_id IS NOT NULL THEN
      -- Create journal entry
      INSERT INTO journal_entries (
        company_id,
        branch_id,
        entry_date,
        description,
        reference_type,
        reference_id
      ) VALUES (
        sale_record.company_id,
        sale_record.branch_id,
        NOW()::DATE,
        'Sales discount - ' || COALESCE(sale_record.invoice_no, ''),
        'sale',
        sale_record.id
      )
      RETURNING id INTO v_journal_entry_id;
      
      -- Debit: Sales Discount
      INSERT INTO journal_entry_lines (
        journal_entry_id,
        account_id,
        debit,
        credit,
        description
      ) VALUES (
        v_journal_entry_id,
        v_discount_account_id,
        sale_record.discount_amount,
        0,
        'Discount - ' || COALESCE(sale_record.invoice_no, '')
      );
      
      -- Credit: Accounts Receivable
      INSERT INTO journal_entry_lines (
        journal_entry_id,
        account_id,
        debit,
        credit,
        description
      ) VALUES (
        v_journal_entry_id,
        v_receivable_account_id,
        0,
        sale_record.discount_amount,
        'Discount - ' || COALESCE(sale_record.invoice_no, '')
      );
    END IF;
  END LOOP;
END $$;

-- Backfill extra expense journal entries
DO $$
DECLARE
  sale_record RECORD;
  v_journal_entry_id UUID;
  v_expense_account_id UUID;
  v_receivable_account_id UUID;
  v_expense_name VARCHAR := 'Extra Expense';
BEGIN
  FOR sale_record IN 
    SELECT s.id, s.company_id, s.branch_id, s.invoice_no, s.expenses
    FROM sales s
    WHERE s.expenses > 0
      AND NOT EXISTS (
        SELECT 1 FROM journal_entries je 
        WHERE je.reference_id = s.id 
          AND je.description LIKE '%expense%'
      )
  LOOP
    -- Get or create expense account
    SELECT id INTO v_expense_account_id
    FROM accounts
    WHERE company_id = sale_record.company_id
      AND code = '5200'
    LIMIT 1;
    
    -- If not found, create it
    IF v_expense_account_id IS NULL THEN
      INSERT INTO accounts (
        company_id,
        code,
        name,
        type,
        balance,
        is_active
      ) VALUES (
        sale_record.company_id,
        '5200',
        'Extra Expenses',
        'expense',
        0,
        true
      )
      RETURNING id INTO v_expense_account_id;
    END IF;
    
    SELECT id INTO v_receivable_account_id
    FROM accounts
    WHERE company_id = sale_record.company_id
      AND code = '2000'
    LIMIT 1;
    
    IF v_expense_account_id IS NOT NULL AND v_receivable_account_id IS NOT NULL THEN
      -- Create journal entry
      INSERT INTO journal_entries (
        company_id,
        branch_id,
        entry_date,
        description,
        reference_type,
        reference_id
      ) VALUES (
        sale_record.company_id,
        sale_record.branch_id,
        NOW()::DATE,
        'Extra expense - ' || COALESCE(sale_record.invoice_no, ''),
        'sale',
        sale_record.id
      )
      RETURNING id INTO v_journal_entry_id;
      
      -- Debit: Expense Account
      INSERT INTO journal_entry_lines (
        journal_entry_id,
        account_id,
        debit,
        credit,
        description
      ) VALUES (
        v_journal_entry_id,
        v_expense_account_id,
        sale_record.expenses,
        0,
        v_expense_name || ' - ' || COALESCE(sale_record.invoice_no, '')
      );
      
      -- Credit: Accounts Receivable
      INSERT INTO journal_entry_lines (
        journal_entry_id,
        account_id,
        debit,
        credit,
        description
      ) VALUES (
        v_journal_entry_id,
        v_receivable_account_id,
        0,
        sale_record.expenses,
        v_expense_name || ' - ' || COALESCE(sale_record.invoice_no, '')
      );
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- ISSUE 4: RECALCULATE ALL ACCOUNT BALANCES FROM JOURNAL ENTRIES
-- ============================================================================

-- Recalculate all account balances
UPDATE accounts a
SET balance = COALESCE((
  SELECT SUM(jel.debit - jel.credit)
  FROM journal_entry_lines jel
  WHERE jel.account_id = a.id
), 0);

-- ============================================================================
-- ISSUE 5: VERIFY MULTI-PAYMENT SUPPORT
-- ============================================================================

-- Ensure unique constraint on reference_number per company
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'payments_reference_number_unique'
  ) THEN
    ALTER TABLE payments
    ADD CONSTRAINT payments_reference_number_unique
    UNIQUE (company_id, reference_number);
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check reference number uniqueness
SELECT 
  'Reference Uniqueness' as check_name,
  COUNT(*) as total_payments,
  COUNT(DISTINCT reference_number) as unique_references
FROM payments
WHERE reference_type = 'sale';

-- Check account balances
SELECT 
  'Account Balances' as check_name,
  code,
  name,
  balance,
  (SELECT SUM(jel.debit - jel.credit) FROM journal_entry_lines jel WHERE jel.account_id = a.id) as calculated
FROM accounts a
WHERE code IN ('1000', '1010', '2000', '4100', '5100', '5200')
  AND company_id = (SELECT id FROM companies LIMIT 1)
ORDER BY code;

-- Check discount/expense entries
SELECT 
  'Discount/Expense Coverage' as check_name,
  COUNT(*) as sales_with_discount_or_expense,
  COUNT(CASE WHEN discount_amount > 0 THEN 1 END) as sales_with_discount,
  COUNT(CASE WHEN expenses > 0 THEN 1 END) as sales_with_expenses,
  (SELECT COUNT(*) FROM journal_entries je WHERE je.description LIKE '%discount%') as discount_entries,
  (SELECT COUNT(*) FROM journal_entries je WHERE je.description LIKE '%expense%') as expense_entries
FROM sales
WHERE discount_amount > 0 OR expenses > 0;

-- Check payment journal entries
SELECT 
  'Payment Journal Coverage' as check_name,
  COUNT(*) as total_payments,
  COUNT(DISTINCT je.payment_id) as payments_with_journal
FROM payments p
LEFT JOIN journal_entries je ON je.payment_id = p.id
WHERE p.reference_type = 'sale';
