-- ============================================================================
-- LEDGER REDESIGN & REFERENCE NUMBER FIX (V2)
-- ============================================================================
-- This script:
-- 1. Creates functions to generate short reference numbers for journal entries
-- 2. Updates existing journal entries to use short reference numbers
-- 3. Ensures all future entries use proper formats
-- ============================================================================

-- ============================================================================
-- STEP 1: CREATE REFERENCE NUMBER GENERATION FUNCTIONS
-- ============================================================================

-- Function to generate Expense reference numbers (EXP-0001, EXP-0002, ...)
CREATE OR REPLACE FUNCTION generate_expense_reference(
  p_company_id UUID
)
RETURNS VARCHAR AS $$
DECLARE
  v_sequence INTEGER;
  v_reference VARCHAR;
  v_exists BOOLEAN;
BEGIN
  -- Get next sequence number for this company
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(entry_no FROM '[0-9]+$') AS INTEGER)
  ), 0) + 1
  INTO v_sequence
  FROM journal_entries
  WHERE company_id = p_company_id
    AND entry_no ~ '^EXP-[0-9]+$';
  
  -- Ensure sequence is at least 1
  IF v_sequence IS NULL OR v_sequence < 1 THEN
    v_sequence := 1;
  END IF;
  
  -- Format: EXP-0001, EXP-0002, etc.
  v_reference := 'EXP-' || LPAD(v_sequence::TEXT, 4, '0');
  
  -- Check if reference already exists (handle race condition)
  SELECT EXISTS(
    SELECT 1 FROM journal_entries 
    WHERE company_id = p_company_id 
      AND entry_no = v_reference
  ) INTO v_exists;
  
  -- If exists, increment until unique
  WHILE v_exists LOOP
    v_sequence := v_sequence + 1;
    v_reference := 'EXP-' || LPAD(v_sequence::TEXT, 4, '0');
    
    SELECT EXISTS(
      SELECT 1 FROM journal_entries 
      WHERE company_id = p_company_id 
        AND entry_no = v_reference
    ) INTO v_exists;
  END LOOP;
  
  RETURN v_reference;
END;
$$ LANGUAGE plpgsql;

-- Function to generate Manual Journal Entry reference numbers (JE-0001, JE-0002, ...)
CREATE OR REPLACE FUNCTION generate_journal_entry_reference(
  p_company_id UUID
)
RETURNS VARCHAR AS $$
DECLARE
  v_sequence INTEGER;
  v_reference VARCHAR;
  v_exists BOOLEAN;
BEGIN
  -- Get next sequence number for this company
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(entry_no FROM '[0-9]+$') AS INTEGER)
  ), 0) + 1
  INTO v_sequence
  FROM journal_entries
  WHERE company_id = p_company_id
    AND entry_no ~ '^JE-[0-9]+$';
  
  -- Ensure sequence is at least 1
  IF v_sequence IS NULL OR v_sequence < 1 THEN
    v_sequence := 1;
  END IF;
  
  -- Format: JE-0001, JE-0002, etc.
  v_reference := 'JE-' || LPAD(v_sequence::TEXT, 4, '0');
  
  -- Check if reference already exists (handle race condition)
  SELECT EXISTS(
    SELECT 1 FROM journal_entries 
    WHERE company_id = p_company_id 
      AND entry_no = v_reference
  ) INTO v_exists;
  
  -- If exists, increment until unique
  WHILE v_exists LOOP
    v_sequence := v_sequence + 1;
    v_reference := 'JE-' || LPAD(v_sequence::TEXT, 4, '0');
    
    SELECT EXISTS(
      SELECT 1 FROM journal_entries 
      WHERE company_id = p_company_id 
        AND entry_no = v_reference
    ) INTO v_exists;
  END LOOP;
  
  RETURN v_reference;
END;
$$ LANGUAGE plpgsql;

-- Function to generate Transfer reference numbers (TRF-0001, TRF-0002, ...)
CREATE OR REPLACE FUNCTION generate_transfer_reference(
  p_company_id UUID
)
RETURNS VARCHAR AS $$
DECLARE
  v_sequence INTEGER;
  v_reference VARCHAR;
  v_exists BOOLEAN;
BEGIN
  -- Get next sequence number for this company
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(entry_no FROM '[0-9]+$') AS INTEGER)
  ), 0) + 1
  INTO v_sequence
  FROM journal_entries
  WHERE company_id = p_company_id
    AND entry_no ~ '^TRF-[0-9]+$';
  
  -- Ensure sequence is at least 1
  IF v_sequence IS NULL OR v_sequence < 1 THEN
    v_sequence := 1;
  END IF;
  
  -- Format: TRF-0001, TRF-0002, etc.
  v_reference := 'TRF-' || LPAD(v_sequence::TEXT, 4, '0');
  
  -- Check if reference already exists (handle race condition)
  SELECT EXISTS(
    SELECT 1 FROM journal_entries 
    WHERE company_id = p_company_id 
      AND entry_no = v_reference
  ) INTO v_exists;
  
  -- If exists, increment until unique
  WHILE v_exists LOOP
    v_sequence := v_sequence + 1;
    v_reference := 'TRF-' || LPAD(v_sequence::TEXT, 4, '0');
    
    SELECT EXISTS(
      SELECT 1 FROM journal_entries 
      WHERE company_id = p_company_id 
        AND entry_no = v_reference
    ) INTO v_exists;
  END LOOP;
  
  RETURN v_reference;
END;
$$ LANGUAGE plpgsql;

-- Universal function to generate reference based on reference_type
CREATE OR REPLACE FUNCTION generate_journal_entry_reference_by_type(
  p_company_id UUID,
  p_reference_type VARCHAR
)
RETURNS VARCHAR AS $$
DECLARE
  v_reference VARCHAR;
BEGIN
  CASE 
    WHEN p_reference_type = 'expense' OR p_reference_type = 'extra_expense' THEN
      v_reference := generate_expense_reference(p_company_id);
    WHEN p_reference_type = 'manual' OR p_reference_type = 'journal' THEN
      v_reference := generate_journal_entry_reference(p_company_id);
    WHEN p_reference_type = 'transfer' THEN
      v_reference := generate_transfer_reference(p_company_id);
    ELSE
      -- Default to JE for unknown types
      v_reference := generate_journal_entry_reference(p_company_id);
  END CASE;
  
  RETURN v_reference;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 2: UPDATE EXISTING JOURNAL ENTRIES WITH SHORT REFERENCE NUMBERS
-- ============================================================================

-- Update expense-related journal entries
DO $$
DECLARE
  entry_record RECORD;
  v_sequence INTEGER;
  v_new_ref VARCHAR;
BEGIN
  -- Process each company separately
  FOR entry_record IN 
    SELECT je.id, je.company_id, je.reference_type
    FROM journal_entries je
    WHERE (je.entry_no IS NULL OR je.entry_no = '' OR je.entry_no ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR LENGTH(je.entry_no) > 20)
      AND (je.reference_type = 'expense' OR je.reference_type = 'extra_expense' OR je.description ILIKE '%expense%')
    ORDER BY je.created_at
  LOOP
    v_new_ref := generate_expense_reference(entry_record.company_id);
    UPDATE journal_entries
    SET entry_no = v_new_ref
    WHERE id = entry_record.id;
  END LOOP;
END $$;

-- Update manual journal entries
DO $$
DECLARE
  entry_record RECORD;
  v_new_ref VARCHAR;
BEGIN
  FOR entry_record IN 
    SELECT je.id, je.company_id, je.reference_type
    FROM journal_entries je
    WHERE (je.entry_no IS NULL OR je.entry_no = '' OR je.entry_no ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR LENGTH(je.entry_no) > 20)
      AND (je.reference_type = 'manual' OR je.reference_type = 'journal' OR je.reference_type IS NULL)
      AND je.description NOT ILIKE '%expense%'
      AND je.description NOT ILIKE '%payment%'
    ORDER BY je.created_at
  LOOP
    v_new_ref := generate_journal_entry_reference(entry_record.company_id);
    UPDATE journal_entries
    SET entry_no = v_new_ref
    WHERE id = entry_record.id;
  END LOOP;
END $$;

-- Update transfer entries
DO $$
DECLARE
  entry_record RECORD;
  v_new_ref VARCHAR;
BEGIN
  FOR entry_record IN 
    SELECT je.id, je.company_id, je.reference_type
    FROM journal_entries je
    WHERE (je.entry_no IS NULL OR je.entry_no = '' OR je.entry_no ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR LENGTH(je.entry_no) > 20)
      AND (je.reference_type = 'transfer' OR je.description ILIKE '%transfer%')
    ORDER BY je.created_at
  LOOP
    v_new_ref := generate_transfer_reference(entry_record.company_id);
    UPDATE journal_entries
    SET entry_no = v_new_ref
    WHERE id = entry_record.id;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 3: CREATE TRIGGER TO AUTO-GENERATE REFERENCE NUMBERS
-- ============================================================================

-- Function to auto-set entry_no if missing
CREATE OR REPLACE FUNCTION set_journal_entry_reference()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate if not provided or empty or looks like UUID
  IF NEW.entry_no IS NULL OR NEW.entry_no = '' OR 
     NEW.entry_no ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR
     LENGTH(NEW.entry_no) > 20 THEN
    NEW.entry_no := generate_journal_entry_reference_by_type(NEW.company_id, COALESCE(NEW.reference_type, 'manual'));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_set_journal_entry_reference ON journal_entries;

-- Create trigger
CREATE TRIGGER trigger_set_journal_entry_reference
BEFORE INSERT ON journal_entries
FOR EACH ROW
EXECUTE FUNCTION set_journal_entry_reference();

-- ============================================================================
-- STEP 4: UPDATE EXPENSE JOURNAL ENTRY FUNCTIONS TO USE NEW REFERENCE FORMAT
-- ============================================================================

-- Update create_extra_expense_journal_entry to use EXP reference
CREATE OR REPLACE FUNCTION create_extra_expense_journal_entry(
  p_company_id UUID,
  p_branch_id UUID,
  p_sale_id UUID,
  p_expense_name VARCHAR,
  p_expense_amount NUMERIC,
  p_invoice_no VARCHAR DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_expense_account_id UUID;
  v_receivable_account_id UUID;
  v_journal_entry_id UUID;
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
  
  IF p_expense_amount > 0 THEN
    -- Generate reference number
    v_entry_no := generate_expense_reference(p_company_id);
    
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
      'Extra Expense – ' || p_expense_name || COALESCE(' (Invoice ' || p_invoice_no || ')', ''),
      'expense',
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
      p_expense_name || COALESCE(' - ' || p_invoice_no, '')
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
      p_expense_name || COALESCE(' - ' || p_invoice_no, '')
    );
  END IF;
  
  RETURN v_journal_entry_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check reference number formats
SELECT 
  entry_no,
  reference_type,
  description,
  created_at
FROM journal_entries
WHERE entry_no IS NOT NULL
ORDER BY created_at DESC
LIMIT 20;

-- Count by reference type
SELECT 
  CASE 
    WHEN entry_no ~ '^EXP-' THEN 'Expense'
    WHEN entry_no ~ '^JE-' THEN 'Journal Entry'
    WHEN entry_no ~ '^TRF-' THEN 'Transfer'
    WHEN entry_no ~ '^PAY-' OR entry_no ~ '^CASH-' OR entry_no ~ '^BANK-' THEN 'Payment'
    ELSE 'Other'
  END AS ref_type,
  COUNT(*) as count
FROM journal_entries
WHERE entry_no IS NOT NULL
GROUP BY ref_type;
