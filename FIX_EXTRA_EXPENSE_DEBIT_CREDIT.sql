-- ============================================================================
-- CRITICAL FIX: EXTRA EXPENSES SHOULD BE DEBIT (NOT CREDIT)
-- ============================================================================
-- Root Cause: Extra expenses are being created with CREDIT for AR account
-- Rule: Extra charges increase receivable → should be DEBIT
-- ============================================================================

-- STEP 1: Check current state
-- ============================================================================
SELECT 
  'CURRENT STATE' AS status,
  COUNT(*) AS extra_expense_entries,
  SUM(CASE WHEN jel.debit > 0 THEN 1 ELSE 0 END) AS debit_count,
  SUM(CASE WHEN jel.credit > 0 THEN 1 ELSE 0 END) AS credit_count
FROM journal_entries je
JOIN journal_entry_lines jel ON je.id = jel.journal_entry_id
JOIN accounts a ON jel.account_id = a.id
WHERE a.code = '2000'  -- Accounts Receivable
  AND je.description ILIKE '%extra expense%'
  AND je.reference_type = 'sale'
  AND je.payment_id IS NULL;

-- STEP 2: Fix create_extra_expense_journal_entry function
-- ============================================================================

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
  v_entry_no VARCHAR;
BEGIN
  -- Get Extra Expense account (code 5200) or create if missing
  SELECT id INTO v_expense_account_id
  FROM accounts
  WHERE company_id = p_company_id
    AND code = '5200'
  LIMIT 1;
  
  IF v_expense_account_id IS NULL THEN
    -- Create Extra Expense account if missing
    INSERT INTO accounts (company_id, code, name, type, balance, is_active)
    VALUES (p_company_id, '5200', 'Extra Expenses', 'expense', 0, true)
    RETURNING id INTO v_expense_account_id;
  END IF;
  
  -- Get Accounts Receivable account
  SELECT id INTO v_receivable_account_id
  FROM accounts
  WHERE company_id = p_company_id
    AND code = '2000'
  LIMIT 1;
  
  IF v_receivable_account_id IS NULL THEN
    RAISE EXCEPTION 'Accounts Receivable account (2000) not found';
  END IF;
  
  -- Generate reference number
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_expense_reference') THEN
    v_entry_no := generate_expense_reference(p_company_id);
  ELSE
    v_entry_no := 'EXP-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD((SELECT COUNT(*) + 1 FROM journal_entries WHERE company_id = p_company_id)::TEXT, 4, '0');
  END IF;
  
  IF p_expense_amount > 0 THEN
    -- Create journal entry
    INSERT INTO journal_entries (
      company_id,
      branch_id,
      entry_no,
      entry_date,
      description,
      reference_type,
      reference_id
    ) VALUES (
      p_company_id,
      p_branch_id,
      v_entry_no,
      NOW()::DATE,
      'Extra expense: ' || COALESCE(p_expense_name, 'Extra Expense') || ' - ' || COALESCE(p_invoice_no, ''),
      'sale',
      p_sale_id
    )
    RETURNING id INTO v_journal_entry_id;
    
    -- CRITICAL FIX: Debit Extra Expense Account (increases expense)
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
      'Extra expense - ' || COALESCE(p_invoice_no, '')
    );
    
    -- CRITICAL FIX: Debit Accounts Receivable (increases receivable - customer owes more)
    -- Extra expense increases what customer owes, so AR must be DEBIT (not CREDIT)
    INSERT INTO journal_entry_lines (
      journal_entry_id,
      account_id,
      debit,
      credit,
      description
    ) VALUES (
      v_journal_entry_id,
      v_receivable_account_id,
      p_expense_amount,  -- DEBIT (increases receivable)
      0,
      'Extra expense added to sale - ' || COALESCE(p_invoice_no, '')
    );
  END IF;
  
  RETURN v_journal_entry_id;
END;
$$ LANGUAGE plpgsql;

-- STEP 3: Backfill existing extra expense entries (FIX DATA)
-- ============================================================================
-- This will swap debit/credit for existing extra expense entries on AR account

DO $$
DECLARE
  entry_record RECORD;
  fixed_count INTEGER := 0;
BEGIN
  -- Find all extra expense entries that have CREDIT for AR account (WRONG)
  FOR entry_record IN
    SELECT 
      jel.id AS line_id,
      jel.journal_entry_id,
      jel.debit,
      jel.credit,
      je.entry_no,
      je.description
    FROM journal_entries je
    JOIN journal_entry_lines jel ON je.id = jel.journal_entry_id
    JOIN accounts a ON jel.account_id = a.id
    WHERE a.code = '2000'  -- Accounts Receivable
      AND je.description ILIKE '%extra expense%'
      AND je.reference_type = 'sale'
      AND je.payment_id IS NULL
      AND jel.credit > 0  -- Currently has CREDIT (WRONG)
      AND jel.debit = 0
  LOOP
    -- Swap: Set debit = credit, credit = 0
    UPDATE journal_entry_lines
    SET debit = entry_record.credit,
        credit = 0
    WHERE id = entry_record.line_id;
    
    fixed_count := fixed_count + 1;
    RAISE NOTICE 'Fixed entry %: Swapped credit % to debit', entry_record.entry_no, entry_record.credit;
  END LOOP;
  
  RAISE NOTICE 'Fixed % extra expense entries', fixed_count;
END $$;

-- STEP 4: Verify fix
-- ============================================================================

SELECT 
  'AFTER FIX' AS status,
  COUNT(*) AS extra_expense_entries,
  SUM(CASE WHEN jel.debit > 0 THEN 1 ELSE 0 END) AS debit_count,
  SUM(CASE WHEN jel.credit > 0 THEN 1 ELSE 0 END) AS credit_count,
  SUM(jel.debit) AS total_debit,
  SUM(jel.credit) AS total_credit
FROM journal_entries je
JOIN journal_entry_lines jel ON je.id = jel.journal_entry_id
JOIN accounts a ON jel.account_id = a.id
WHERE a.code = '2000'  -- Accounts Receivable
  AND je.description ILIKE '%extra expense%'
  AND je.reference_type = 'sale'
  AND je.payment_id IS NULL;

-- Expected: All should be DEBIT now
