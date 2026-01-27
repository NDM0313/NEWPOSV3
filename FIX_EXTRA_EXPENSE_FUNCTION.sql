-- ============================================================================
-- CRITICAL FIX: Extra Expense Function - DEBIT AR (Not CREDIT)
-- ============================================================================
-- Current bug: Extra expenses are crediting AR (decreases receivable)
-- Correct: Extra expenses should debit AR (increases receivable)
-- ============================================================================

-- Fix the create_extra_expense_journal_entry function
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
    
    -- Debit: Expense Account (increases expense)
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

-- Verify the fix
SELECT 
  'Function updated' AS status,
  proname AS function_name,
  prosrc LIKE '%p_expense_amount,  -- DEBIT%' AS has_debit_fix
FROM pg_proc
WHERE proname = 'create_extra_expense_journal_entry';
