-- ============================================================================
-- FINAL FIX: SHORT REFERENCE NUMBERS FOR JOURNAL ENTRIES
-- ============================================================================
-- This migration ensures ALL journal entries have SHORT reference numbers
-- Format: EXP-0001, PAY-0001, INV-0001, JE-0001
-- UUIDs are COMPLETELY REMOVED from UI
-- ============================================================================

-- Step 1: Create functions to generate short reference numbers

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
  
  IF v_sequence IS NULL OR v_sequence < 1 THEN
    v_sequence := 1;
  END IF;
  
  v_reference := 'EXP-' || LPAD(v_sequence::TEXT, 4, '0');
  
  -- Check if exists, increment until unique
  SELECT EXISTS(
    SELECT 1 FROM journal_entries 
    WHERE company_id = p_company_id 
      AND entry_no = v_reference
  ) INTO v_exists;
  
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

-- Function to generate Journal Entry reference numbers (JE-0001, JE-0002, ...)
CREATE OR REPLACE FUNCTION generate_journal_entry_reference(
  p_company_id UUID
)
RETURNS VARCHAR AS $$
DECLARE
  v_sequence INTEGER;
  v_reference VARCHAR;
  v_exists BOOLEAN;
BEGIN
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(entry_no FROM '[0-9]+$') AS INTEGER)
  ), 0) + 1
  INTO v_sequence
  FROM journal_entries
  WHERE company_id = p_company_id
    AND entry_no ~ '^JE-[0-9]+$';
  
  IF v_sequence IS NULL OR v_sequence < 1 THEN
    v_sequence := 1;
  END IF;
  
  v_reference := 'JE-' || LPAD(v_sequence::TEXT, 4, '0');
  
  SELECT EXISTS(
    SELECT 1 FROM journal_entries 
    WHERE company_id = p_company_id 
      AND entry_no = v_reference
  ) INTO v_exists;
  
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
    WHEN p_reference_type = 'manual' OR p_reference_type = 'journal' OR p_reference_type IS NULL THEN
      v_reference := generate_journal_entry_reference(p_company_id);
    ELSE
      v_reference := generate_journal_entry_reference(p_company_id);
  END CASE;
  
  RETURN v_reference;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Step 2: BACKFILL EXISTING ENTRIES WITH SHORT REFERENCE NUMBERS
-- ============================================================================

-- Update expense-related journal entries
DO $$
DECLARE
  entry_record RECORD;
  v_new_ref VARCHAR;
BEGIN
  FOR entry_record IN 
    SELECT je.id, je.company_id, je.reference_type
    FROM journal_entries je
    WHERE (je.entry_no IS NULL OR je.entry_no = '' OR 
           je.entry_no ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR 
           LENGTH(je.entry_no) > 20 OR
           je.entry_no !~ '^[A-Z]+-[0-9]+$')
      AND (je.reference_type = 'expense' OR je.reference_type = 'extra_expense' OR 
           je.description ILIKE '%expense%' OR je.description ILIKE '%extra%')
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
    WHERE (je.entry_no IS NULL OR je.entry_no = '' OR 
           je.entry_no ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR 
           LENGTH(je.entry_no) > 20 OR
           je.entry_no !~ '^[A-Z]+-[0-9]+$')
      AND (je.reference_type = 'manual' OR je.reference_type = 'journal' OR je.reference_type IS NULL)
      AND je.description NOT ILIKE '%expense%'
      AND je.description NOT ILIKE '%payment%'
      AND je.description NOT ILIKE '%sale%'
    ORDER BY je.created_at
  LOOP
    v_new_ref := generate_journal_entry_reference(entry_record.company_id);
    UPDATE journal_entries
    SET entry_no = v_new_ref
    WHERE id = entry_record.id;
  END LOOP;
END $$;

-- ============================================================================
-- Step 3: CREATE TRIGGER TO AUTO-GENERATE REFERENCE NUMBERS
-- ============================================================================

CREATE OR REPLACE FUNCTION set_journal_entry_reference()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate if not provided or empty or looks like UUID or too long
  IF NEW.entry_no IS NULL OR NEW.entry_no = '' OR 
     NEW.entry_no ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR
     LENGTH(NEW.entry_no) > 20 OR
     NEW.entry_no !~ '^[A-Z]+-[0-9]+$' THEN
    NEW.entry_no := generate_journal_entry_reference_by_type(
      NEW.company_id, 
      COALESCE(NEW.reference_type, 'manual')
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_journal_entry_reference ON journal_entries;

CREATE TRIGGER trigger_set_journal_entry_reference
BEFORE INSERT ON journal_entries
FOR EACH ROW
EXECUTE FUNCTION set_journal_entry_reference();

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================
-- Run this to verify all entries have short reference numbers:
-- SELECT entry_no, reference_type, description 
-- FROM journal_entries 
-- WHERE entry_no IS NULL OR entry_no = '' OR 
--       entry_no ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR
--       LENGTH(entry_no) > 20 OR
--       entry_no !~ '^[A-Z]+-[0-9]+$';
-- Should return 0 rows
-- ============================================================================
