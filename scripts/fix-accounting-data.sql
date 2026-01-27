-- ============================================================================
-- AUTOMATIC ACCOUNTING DATA FIX SCRIPT
-- ============================================================================
-- This script fixes common data integrity issues
-- Run in Supabase SQL Editor
-- ============================================================================

-- STEP 1: Fix entries with both debit and credit > 0 (DATA CORRUPTION)
-- ============================================================================
-- This should never happen in proper double-entry accounting
-- If found, we need to investigate the root cause

DO $$
DECLARE
  corrupted_count INTEGER;
BEGIN
  -- Count corrupted entries
  SELECT COUNT(*) INTO corrupted_count
  FROM journal_entries je
  JOIN journal_entry_lines jel ON je.id = jel.journal_entry_id
  JOIN accounts a ON jel.account_id = a.id
  WHERE a.code = '2000'  -- Accounts Receivable
    AND jel.debit > 0 
    AND jel.credit > 0;

  IF corrupted_count > 0 THEN
    RAISE NOTICE 'Found % corrupted entries (both debit and credit > 0)', corrupted_count;
    RAISE NOTICE 'These need manual investigation - cannot auto-fix';
    -- Log the corrupted entries for manual review
    CREATE TEMP TABLE IF NOT EXISTS corrupted_entries AS
    SELECT 
      je.id,
      je.entry_no,
      jel.debit,
      jel.credit,
      je.description
    FROM journal_entries je
    JOIN journal_entry_lines jel ON je.id = jel.journal_entry_id
    JOIN accounts a ON jel.account_id = a.id
    WHERE a.code = '2000'
      AND jel.debit > 0 
      AND jel.credit > 0;
  ELSE
    RAISE NOTICE 'No corrupted entries found';
  END IF;
END $$;

-- STEP 2: Fix payments without journal_entry_id
-- ============================================================================
-- Link payments to their journal entries

DO $$
DECLARE
  unlinked_count INTEGER;
  linked_count INTEGER;
BEGIN
  -- Count unlinked payments
  SELECT COUNT(*) INTO unlinked_count
  FROM payments p
  WHERE p.journal_entry_id IS NULL;

  IF unlinked_count > 0 THEN
    RAISE NOTICE 'Found % payments without journal_entry_id', unlinked_count;
    
    -- Try to link payments to journal entries
    UPDATE payments p
    SET journal_entry_id = je.id
    FROM journal_entries je
    WHERE p.journal_entry_id IS NULL
      AND je.payment_id = p.id
      AND je.payment_id IS NOT NULL;
    
    GET DIAGNOSTICS linked_count = ROW_COUNT;
    RAISE NOTICE 'Linked % payments to journal entries', linked_count;
  ELSE
    RAISE NOTICE 'All payments are linked to journal entries';
  END IF;
END $$;

-- STEP 3: Fix missing entry_no values
-- ============================================================================
-- Generate entry_no for entries that are missing it

DO $$
DECLARE
  missing_count INTEGER;
  fixed_count INTEGER;
  entry_record RECORD;
  v_new_ref VARCHAR;
BEGIN
  -- Count entries with missing entry_no
  SELECT COUNT(*) INTO missing_count
  FROM journal_entries je
  WHERE je.entry_no IS NULL 
     OR je.entry_no = ''
     OR je.entry_no ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR LENGTH(je.entry_no) > 50;

  IF missing_count > 0 THEN
    RAISE NOTICE 'Found % entries with missing/invalid entry_no', missing_count;
    
    -- Check if reference generation functions exist
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_journal_entry_reference_by_type') THEN
      -- Use existing function
      FOR entry_record IN 
        SELECT je.id, je.company_id, je.reference_type, je.payment_id, je.reference_id
        FROM journal_entries je
        WHERE je.entry_no IS NULL 
           OR je.entry_no = ''
           OR je.entry_no ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           OR LENGTH(je.entry_no) > 50
        ORDER BY je.created_at
      LOOP
        BEGIN
          -- Generate appropriate reference based on type
          IF entry_record.payment_id IS NOT NULL THEN
            v_new_ref := generate_journal_entry_reference_by_type(entry_record.company_id, 'payment');
          ELSIF entry_record.reference_type = 'sale' THEN
            v_new_ref := generate_journal_entry_reference_by_type(entry_record.company_id, 'sale');
          ELSIF entry_record.reference_type = 'expense' THEN
            v_new_ref := generate_expense_reference(entry_record.company_id);
          ELSE
            v_new_ref := generate_journal_entry_reference(entry_record.company_id);
          END IF;
          
          UPDATE journal_entries
          SET entry_no = v_new_ref
          WHERE id = entry_record.id;
          
          fixed_count := fixed_count + 1;
        EXCEPTION WHEN OTHERS THEN
          RAISE NOTICE 'Error fixing entry %: %', entry_record.id, SQLERRM;
        END;
      END LOOP;
      
      RAISE NOTICE 'Fixed % entries with missing entry_no', fixed_count;
    ELSE
      RAISE NOTICE 'Reference generation functions not found - skipping entry_no fix';
      RAISE NOTICE 'Please run LEDGER_REDESIGN_AND_REFNO_FIX.sql first';
    END IF;
  ELSE
    RAISE NOTICE 'All entries have valid entry_no';
  END IF;
END $$;

-- STEP 4: Verify final state
-- ============================================================================

SELECT 
  'VERIFICATION SUMMARY' AS status,
  (SELECT COUNT(*) FROM journal_entries je
   JOIN journal_entry_lines jel ON je.id = jel.journal_entry_id
   JOIN accounts a ON jel.account_id = a.id
   WHERE a.code = '2000' AND jel.debit > 0 AND jel.credit > 0) AS corrupted_entries,
  (SELECT COUNT(*) FROM payments WHERE journal_entry_id IS NULL) AS unlinked_payments,
  (SELECT COUNT(*) FROM journal_entries 
   WHERE entry_no IS NULL OR entry_no = '' 
   OR entry_no ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') AS missing_entry_no;
