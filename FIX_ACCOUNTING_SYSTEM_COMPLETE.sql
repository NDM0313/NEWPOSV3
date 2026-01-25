-- ============================================================================
-- COMPLETE ACCOUNTING SYSTEM FIX
-- Addresses all 10 requirements for production-grade ERP
-- ============================================================================

-- ============================================================================
-- STEP 1: CLEANUP DUPLICATE ACCOUNTS
-- ============================================================================

-- Remove duplicate accounts, keep one per company/branch/code
DELETE FROM accounts a1
WHERE EXISTS (
  SELECT 1 FROM accounts a2
  WHERE a2.company_id = a1.company_id
    AND a2.code = a1.code
    AND a2.id < a1.id
);

-- ============================================================================
-- STEP 2: ENSURE DEFAULT ACCOUNTS EXIST (AUTO-CREATE IF MISSING)
-- ============================================================================

-- Function to ensure default accounts exist
CREATE OR REPLACE FUNCTION ensure_default_accounts(p_company_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Cash Account (1000)
  INSERT INTO accounts (company_id, code, name, type, balance, is_active)
  VALUES (p_company_id, '1000', 'Cash', 'asset', 0, true)
  ON CONFLICT (company_id, code) DO NOTHING;
  
  -- Bank Account (1010)
  INSERT INTO accounts (company_id, code, name, type, balance, is_active)
  VALUES (p_company_id, '1010', 'Bank', 'asset', 0, true)
  ON CONFLICT (company_id, code) DO NOTHING;
  
  -- Accounts Receivable (2000)
  INSERT INTO accounts (company_id, code, name, type, balance, is_active)
  VALUES (p_company_id, '2000', 'Accounts Receivable', 'asset', 0, true)
  ON CONFLICT (company_id, code) DO NOTHING;
  
  -- Sales Discount Account (4100)
  INSERT INTO accounts (company_id, code, name, type, balance, is_active)
  VALUES (p_company_id, '4100', 'Sales Discount', 'expense', 0, true)
  ON CONFLICT (company_id, code) DO NOTHING;
  
  -- Commission Expense Account (5100)
  INSERT INTO accounts (company_id, code, name, type, balance, is_active)
  VALUES (p_company_id, '5100', 'Commission Expense', 'expense', 0, true)
  ON CONFLICT (company_id, code) DO NOTHING;
  
  -- Extra Expense Account (5200) - for stitching, etc.
  INSERT INTO accounts (company_id, code, name, type, balance, is_active)
  VALUES (p_company_id, '5200', 'Extra Expenses', 'expense', 0, true)
  ON CONFLICT (company_id, code) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Create default accounts for all existing companies
DO $$
DECLARE
  company_record RECORD;
BEGIN
  FOR company_record IN SELECT DISTINCT id FROM companies
  LOOP
    PERFORM ensure_default_accounts(company_record.id);
  END LOOP;
END $$;

-- ============================================================================
-- STEP 3: FIX REFERENCE NUMBER GENERATION (SEQUENTIAL, SHORT)
-- ============================================================================

-- Drop old function if exists
DROP FUNCTION IF EXISTS generate_payment_reference(UUID, VARCHAR);

-- Create new sequential reference generator
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
BEGIN
  -- Determine prefix based on payment method
  CASE p_payment_method
    WHEN 'cash' THEN v_prefix := 'CASH';
    WHEN 'bank' THEN v_prefix := 'BANK';
    WHEN 'card' THEN v_prefix := 'CARD';
    ELSE v_prefix := 'PAY';
  END CASE;
  
  -- Get next sequence number for this company, method, and year
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(reference_number FROM '[0-9]+$') AS INTEGER)
  ), 0) + 1
  INTO v_sequence
  FROM payments
  WHERE company_id = p_company_id
    AND payment_method = p_payment_method
    AND reference_number LIKE v_prefix || '-' || v_year || '-%';
  
  -- Format: CASH-2026-0001, BANK-2026-0001, etc.
  v_reference := v_prefix || '-' || v_year || '-' || LPAD(v_sequence::TEXT, 4, '0');
  
  RETURN v_reference;
END;
$$ LANGUAGE plpgsql;

-- Update trigger to use new function
DROP TRIGGER IF EXISTS trigger_set_payment_reference ON payments;
DROP FUNCTION IF EXISTS set_payment_reference();

CREATE OR REPLACE FUNCTION set_payment_reference()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reference_number IS NULL OR NEW.reference_number = '' THEN
    NEW.reference_number := generate_payment_reference(NEW.company_id, NEW.payment_method);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_payment_reference
BEFORE INSERT ON payments
FOR EACH ROW
EXECUTE FUNCTION set_payment_reference();

-- ============================================================================
-- STEP 4: ADD UNIQUE CONSTRAINT ON PAYMENT REFERENCE
-- ============================================================================

-- Add unique constraint on reference_number per company
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
-- STEP 5: ENSURE LEDGER ENTRIES FOR EVERY PAYMENT
-- ============================================================================

-- Function to create journal entry for payment
CREATE OR REPLACE FUNCTION create_payment_journal_entry(
  p_payment_id UUID,
  p_company_id UUID,
  p_branch_id UUID,
  p_sale_id UUID,
  p_amount NUMERIC,
  p_payment_account_id UUID,
  p_customer_name VARCHAR
)
RETURNS UUID AS $$
DECLARE
  v_journal_entry_id UUID;
  v_receivable_account_id UUID;
  v_invoice_no VARCHAR;
BEGIN
  -- Get Accounts Receivable account
  SELECT id INTO v_receivable_account_id
  FROM accounts
  WHERE company_id = p_company_id
    AND code = '2000'
  LIMIT 1;
  
  IF v_receivable_account_id IS NULL THEN
    RAISE EXCEPTION 'Accounts Receivable account (2000) not found';
  END IF;
  
  -- Get invoice number
  SELECT invoice_no INTO v_invoice_no
  FROM sales
  WHERE id = p_sale_id;
  
  -- Create journal entry
  INSERT INTO journal_entries (
    company_id,
    branch_id,
    entry_date,
    description,
    reference_type,
    reference_id,
    payment_id
  ) VALUES (
    p_company_id,
    p_branch_id,
    NOW()::DATE,
    'Payment received from ' || COALESCE(p_customer_name, 'Customer'),
    'sale',
    p_sale_id,
    p_payment_id
  )
  RETURNING id INTO v_journal_entry_id;
  
  -- Debit: Cash/Bank Account
  INSERT INTO journal_entry_lines (
    journal_entry_id,
    account_id,
    debit,
    credit,
    description
  ) VALUES (
    v_journal_entry_id,
    p_payment_account_id,
    p_amount,
    0,
    'Payment received - ' || COALESCE(v_invoice_no, '')
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
    p_amount,
    'Payment received - ' || COALESCE(v_invoice_no, '')
  );
  
  RETURN v_journal_entry_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create journal entry when payment is inserted
CREATE OR REPLACE FUNCTION auto_create_payment_journal_entry()
RETURNS TRIGGER AS $$
DECLARE
  v_sale_id UUID;
  v_customer_name VARCHAR;
BEGIN
  -- Only process sale payments
  IF NEW.reference_type = 'sale' AND NEW.reference_id IS NOT NULL THEN
    v_sale_id := NEW.reference_id;
    
    -- Get customer name
    SELECT customer_name INTO v_customer_name
    FROM sales
    WHERE id = v_sale_id;
    
    -- Create journal entry
    PERFORM create_payment_journal_entry(
      NEW.id,
      NEW.company_id,
      NEW.branch_id,
      v_sale_id,
      NEW.amount,
      NEW.payment_account_id,
      v_customer_name
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_create_payment_journal ON payments;
CREATE TRIGGER trigger_auto_create_payment_journal
AFTER INSERT ON payments
FOR EACH ROW
EXECUTE FUNCTION auto_create_payment_journal_entry();

-- ============================================================================
-- STEP 6: HANDLE DISCOUNTS IN JOURNAL ENTRIES
-- ============================================================================

-- Function to create discount journal entry
CREATE OR REPLACE FUNCTION create_discount_journal_entry(
  p_sale_id UUID,
  p_company_id UUID,
  p_branch_id UUID,
  p_discount_amount NUMERIC,
  p_invoice_no VARCHAR
)
RETURNS UUID AS $$
DECLARE
  v_journal_entry_id UUID;
  v_discount_account_id UUID;
  v_receivable_account_id UUID;
BEGIN
  -- Get Sales Discount account
  SELECT id INTO v_discount_account_id
  FROM accounts
  WHERE company_id = p_company_id
    AND code = '4100'
  LIMIT 1;
  
  -- Get Accounts Receivable account
  SELECT id INTO v_receivable_account_id
  FROM accounts
  WHERE company_id = p_company_id
    AND code = '2000'
  LIMIT 1;
  
  IF v_discount_account_id IS NULL OR v_receivable_account_id IS NULL THEN
    RAISE EXCEPTION 'Required accounts not found for discount entry';
  END IF;
  
  IF p_discount_amount > 0 THEN
    -- Create journal entry
    INSERT INTO journal_entries (
      company_id,
      branch_id,
      entry_date,
      description,
      reference_type,
      reference_id
    ) VALUES (
      p_company_id,
      p_branch_id,
      NOW()::DATE,
      'Sales discount - ' || COALESCE(p_invoice_no, ''),
      'sale',
      p_sale_id
    )
    RETURNING id INTO v_journal_entry_id;
    
    -- Debit: Sales Discount Account
    INSERT INTO journal_entry_lines (
      journal_entry_id,
      account_id,
      debit,
      credit,
      description
    ) VALUES (
      v_journal_entry_id,
      v_discount_account_id,
      p_discount_amount,
      0,
      'Discount - ' || COALESCE(p_invoice_no, '')
    );
    
    -- Credit: Accounts Receivable (reduces receivable)
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
      p_discount_amount,
      'Discount - ' || COALESCE(p_invoice_no, '')
    );
  END IF;
  
  RETURN v_journal_entry_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 7: HANDLE COMMISSION IN JOURNAL ENTRIES
-- ============================================================================

-- Function to create commission journal entry
CREATE OR REPLACE FUNCTION create_commission_journal_entry(
  p_sale_id UUID,
  p_company_id UUID,
  p_branch_id UUID,
  p_commission_amount NUMERIC,
  p_salesperson_id UUID,
  p_invoice_no VARCHAR
)
RETURNS UUID AS $$
DECLARE
  v_journal_entry_id UUID;
  v_commission_account_id UUID;
  v_receivable_account_id UUID;
BEGIN
  -- Get Commission Expense account
  SELECT id INTO v_commission_account_id
  FROM accounts
  WHERE company_id = p_company_id
    AND code = '5100'
  LIMIT 1;
  
  -- Get Accounts Receivable account
  SELECT id INTO v_receivable_account_id
  FROM accounts
  WHERE company_id = p_company_id
    AND code = '2000'
  LIMIT 1;
  
  IF v_commission_account_id IS NULL OR v_receivable_account_id IS NULL THEN
    RAISE EXCEPTION 'Required accounts not found for commission entry';
  END IF;
  
  IF p_commission_amount > 0 THEN
    -- Create journal entry
    INSERT INTO journal_entries (
      company_id,
      branch_id,
      entry_date,
      description,
      reference_type,
      reference_id
    ) VALUES (
      p_company_id,
      p_branch_id,
      NOW()::DATE,
      'Commission expense - ' || COALESCE(p_invoice_no, ''),
      'sale',
      p_sale_id
    )
    RETURNING id INTO v_journal_entry_id;
    
    -- Debit: Commission Expense Account
    INSERT INTO journal_entry_lines (
      journal_entry_id,
      account_id,
      debit,
      credit,
      description
    ) VALUES (
      v_journal_entry_id,
      v_commission_account_id,
      p_commission_amount,
      0,
      'Commission - ' || COALESCE(p_invoice_no, '')
    );
    
    -- Credit: Accounts Receivable (reduces receivable)
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
      p_commission_amount,
      'Commission - ' || COALESCE(p_invoice_no, '')
    );
  END IF;
  
  RETURN v_journal_entry_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 8: HANDLE EXTRA EXPENSES (AUTO-CREATE ACCOUNT IF MISSING)
-- ============================================================================

-- Function to get or create extra expense account
CREATE OR REPLACE FUNCTION get_or_create_extra_expense_account(
  p_company_id UUID,
  p_expense_name VARCHAR
)
RETURNS UUID AS $$
DECLARE
  v_account_id UUID;
  v_account_code VARCHAR;
  v_next_code INTEGER;
BEGIN
  -- Try to find existing account with matching name
  SELECT id INTO v_account_id
  FROM accounts
  WHERE company_id = p_company_id
    AND LOWER(name) = LOWER(p_expense_name)
    AND type = 'expense'
  LIMIT 1;
  
  IF v_account_id IS NULL THEN
    -- Get next available code in 5200-5299 range
    SELECT COALESCE(MAX(CAST(code AS INTEGER)), 5199) + 1
    INTO v_next_code
    FROM accounts
    WHERE company_id = p_company_id
      AND code ~ '^[0-9]+$'
      AND CAST(code AS INTEGER) BETWEEN 5200 AND 5299;
    
    -- Ensure code is in valid range
    IF v_next_code > 5299 THEN
      v_next_code := 5200;
    END IF;
    
    v_account_code := v_next_code::TEXT;
    
    -- Create new account
    INSERT INTO accounts (
      company_id,
      code,
      name,
      type,
      balance,
      is_active
    ) VALUES (
      p_company_id,
      v_account_code,
      p_expense_name,
      'expense',
      0,
      true
    )
    RETURNING id INTO v_account_id;
  END IF;
  
  RETURN v_account_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create extra expense journal entry
CREATE OR REPLACE FUNCTION create_extra_expense_journal_entry(
  p_sale_id UUID,
  p_company_id UUID,
  p_branch_id UUID,
  p_expense_amount NUMERIC,
  p_expense_name VARCHAR,
  p_invoice_no VARCHAR
)
RETURNS UUID AS $$
DECLARE
  v_journal_entry_id UUID;
  v_expense_account_id UUID;
  v_receivable_account_id UUID;
BEGIN
  -- Get or create expense account
  v_expense_account_id := get_or_create_extra_expense_account(p_company_id, p_expense_name);
  
  -- Get Accounts Receivable account
  SELECT id INTO v_receivable_account_id
  FROM accounts
  WHERE company_id = p_company_id
    AND code = '2000'
  LIMIT 1;
  
  IF v_receivable_account_id IS NULL THEN
    RAISE EXCEPTION 'Accounts Receivable account (2000) not found';
  END IF;
  
  IF p_expense_amount > 0 THEN
    -- Create journal entry
    INSERT INTO journal_entries (
      company_id,
      branch_id,
      entry_date,
      description,
      reference_type,
      reference_id
    ) VALUES (
      p_company_id,
      p_branch_id,
      NOW()::DATE,
      'Extra expense: ' || p_expense_name || ' - ' || COALESCE(p_invoice_no, ''),
      'sale',
      p_sale_id
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
      p_expense_amount,
      0,
      p_expense_name || ' - ' || COALESCE(p_invoice_no, '')
    );
    
    -- Credit: Accounts Receivable (increases receivable)
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
      p_expense_amount,
      p_expense_name || ' - ' || COALESCE(p_invoice_no, '')
    );
  END IF;
  
  RETURN v_journal_entry_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 9: UPDATE EXISTING REFERENCE NUMBERS TO SEQUENTIAL FORMAT
-- ============================================================================

-- Update existing payments with sequential references
DO $$
DECLARE
  payment_record RECORD;
  v_sequence INTEGER;
  v_year VARCHAR := TO_CHAR(NOW(), 'YYYY');
  v_prefix VARCHAR;
BEGIN
  FOR payment_record IN 
    SELECT DISTINCT company_id, payment_method
    FROM payments
    WHERE reference_number IS NULL 
       OR reference_number = ''
       OR reference_number !~ '^[A-Z]+-[0-9]{4}-[0-9]+$'
  LOOP
    -- Determine prefix
    CASE payment_record.payment_method
      WHEN 'cash' THEN v_prefix := 'CASH';
      WHEN 'bank' THEN v_prefix := 'BANK';
      WHEN 'card' THEN v_prefix := 'CARD';
      ELSE v_prefix := 'PAY';
    END CASE;
    
    -- Get max sequence
    SELECT COALESCE(MAX(
      CAST(SUBSTRING(reference_number FROM '[0-9]+$') AS INTEGER)
    ), 0)
    INTO v_sequence
    FROM payments
    WHERE company_id = payment_record.company_id
      AND payment_method = payment_record.payment_method
      AND reference_number ~ '^' || v_prefix || '-[0-9]{4}-[0-9]+$';
    
    -- Update payments
    FOR payment_record IN 
      SELECT id
      FROM payments
      WHERE company_id = payment_record.company_id
        AND payment_method = payment_record.payment_method
        AND (reference_number IS NULL 
             OR reference_number = ''
             OR reference_number !~ '^[A-Z]+-[0-9]{4}-[0-9]+$')
      ORDER BY created_at
    LOOP
      v_sequence := v_sequence + 1;
      UPDATE payments
      SET reference_number = v_prefix || '-' || v_year || '-' || LPAD(v_sequence::TEXT, 4, '0')
      WHERE id = payment_record.id;
    END LOOP;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 10: VERIFICATION QUERIES
-- ============================================================================

-- Verify default accounts exist
SELECT 
  'Default Accounts Check' as check_name,
  COUNT(*) as account_count
FROM accounts
WHERE code IN ('1000', '1010', '2000', '4100', '5100', '5200')
GROUP BY company_id;

-- Verify no duplicate payments
SELECT 
  'Duplicate Payments Check' as check_name,
  COUNT(*) as duplicate_count
FROM (
  SELECT reference_number, company_id, COUNT(*)
  FROM payments
  GROUP BY reference_number, company_id
  HAVING COUNT(*) > 1
) duplicates;

-- Verify account balances
SELECT 
  'Account Balance Check' as check_name,
  code,
  name,
  balance,
  (SELECT SUM(debit - credit) FROM journal_entry_lines jel WHERE jel.account_id = a.id) as calculated_balance
FROM accounts a
WHERE code IN ('1000', '1010', '2000')
LIMIT 10;
