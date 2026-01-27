-- ============================================================================
-- REAL FIX FOR CUSTOMER LEDGER - VERIFY DATA INTEGRITY
-- ============================================================================
-- This script verifies and fixes the actual data issues
-- ============================================================================

-- STEP 1: VERIFY PAYMENT JOURNAL ENTRIES ARE LINKED TO CUSTOMERS
-- ============================================================================

-- Check if payment journal entries have proper customer linkage
SELECT 
  je.id as journal_entry_id,
  je.entry_no,
  je.payment_id,
  p.contact_id as payment_contact_id,
  p.reference_number as payment_ref,
  s.customer_id as sale_customer_id,
  jel.account_id,
  a.code as account_code,
  a.name as account_name,
  jel.debit,
  jel.credit
FROM journal_entries je
LEFT JOIN payments p ON je.payment_id = p.id
LEFT JOIN sales s ON je.reference_id = s.id AND je.reference_type = 'sale'
JOIN journal_entry_lines jel ON je.id = jel.journal_entry_id
JOIN accounts a ON jel.account_id = a.id
WHERE a.code = '2000'  -- Accounts Receivable
ORDER BY je.created_at DESC
LIMIT 20;

-- STEP 2: VERIFY ENTRY_NO FORMATS
-- ============================================================================

-- Check what entry_no formats exist
SELECT 
  entry_no,
  reference_type,
  COUNT(*) as count
FROM journal_entries
WHERE entry_no IS NOT NULL
GROUP BY entry_no, reference_type
ORDER BY count DESC
LIMIT 20;

-- Check for entries with missing or invalid entry_no
SELECT 
  id,
  entry_no,
  reference_type,
  description,
  created_at
FROM journal_entries
WHERE entry_no IS NULL 
   OR entry_no = ''
   OR entry_no ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   OR LENGTH(entry_no) > 50
ORDER BY created_at DESC
LIMIT 20;

-- STEP 3: UPDATE MISSING ENTRY_NO VALUES
-- ============================================================================

-- Update entries with missing entry_no to use proper format
DO $$
DECLARE
  entry_record RECORD;
  v_new_ref VARCHAR;
BEGIN
  FOR entry_record IN 
    SELECT je.id, je.company_id, je.reference_type, je.payment_id, je.reference_id
    FROM journal_entries je
    WHERE je.entry_no IS NULL 
       OR je.entry_no = ''
       OR je.entry_no ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR LENGTH(je.entry_no) > 50
    ORDER BY je.created_at
  LOOP
    -- Generate appropriate reference based on type
    IF entry_record.payment_id IS NOT NULL THEN
      -- Try to get payment reference
      SELECT reference_number INTO v_new_ref
      FROM payments
      WHERE id = entry_record.payment_id;
      
      IF v_new_ref IS NOT NULL AND v_new_ref != '' THEN
        UPDATE journal_entries
        SET entry_no = v_new_ref
        WHERE id = entry_record.id;
      ELSE
        -- Use payment journal entry reference generator
        v_new_ref := generate_journal_entry_reference_by_type(entry_record.company_id, 'payment');
        UPDATE journal_entries
        SET entry_no = v_new_ref
        WHERE id = entry_record.id;
      END IF;
    ELSIF entry_record.reference_type = 'sale' AND entry_record.reference_id IS NOT NULL THEN
      -- Try to get invoice number
      SELECT invoice_no INTO v_new_ref
      FROM sales
      WHERE id = entry_record.reference_id;
      
      IF v_new_ref IS NOT NULL AND v_new_ref != '' THEN
        UPDATE journal_entries
        SET entry_no = v_new_ref
        WHERE id = entry_record.id;
      ELSE
        v_new_ref := generate_journal_entry_reference_by_type(entry_record.company_id, 'sale');
        UPDATE journal_entries
        SET entry_no = v_new_ref
        WHERE id = entry_record.id;
      END IF;
    ELSIF entry_record.reference_type = 'expense' THEN
      v_new_ref := generate_expense_reference(entry_record.company_id);
      UPDATE journal_entries
      SET entry_no = v_new_ref
      WHERE id = entry_record.id;
    ELSE
      v_new_ref := generate_journal_entry_reference(entry_record.company_id);
      UPDATE journal_entries
      SET entry_no = v_new_ref
      WHERE id = entry_record.id;
    END IF;
  END LOOP;
END $$;

-- STEP 4: VERIFY PAYMENT → CUSTOMER LINKAGE
-- ============================================================================

-- Check if all payment journal entries can be traced to customers
SELECT 
  je.id as journal_entry_id,
  je.entry_no,
  je.payment_id,
  p.contact_id,
  p.sale_id,
  s.customer_id,
  CASE 
    WHEN p.contact_id IS NOT NULL THEN p.contact_id
    WHEN s.customer_id IS NOT NULL THEN s.customer_id
    ELSE NULL
  END as resolved_customer_id
FROM journal_entries je
LEFT JOIN payments p ON je.payment_id = p.id
LEFT JOIN sales s ON p.sale_id = s.id OR (je.reference_id = s.id AND je.reference_type = 'sale')
WHERE je.payment_id IS NOT NULL
ORDER BY je.created_at DESC
LIMIT 20;

-- STEP 5: VERIFY SUMMARY TOTALS CALCULATION
-- ============================================================================

-- For a specific customer, verify what entries should be included
-- Replace 'CUSTOMER_UUID_HERE' with actual customer ID
/*
SELECT 
  'Sales (Debit)' as entry_type,
  SUM(jel.debit) as total
FROM journal_entries je
JOIN journal_entry_lines jel ON je.id = jel.journal_entry_id
JOIN accounts a ON jel.account_id = a.id
JOIN sales s ON je.reference_id = s.id AND je.reference_type = 'sale'
WHERE a.code = '2000'
  AND s.customer_id = 'CUSTOMER_UUID_HERE'
  AND jel.debit > 0

UNION ALL

SELECT 
  'Payments (Credit)' as entry_type,
  SUM(jel.credit) as total
FROM journal_entries je
JOIN journal_entry_lines jel ON je.id = jel.journal_entry_id
JOIN accounts a ON jel.account_id = a.id
JOIN payments p ON je.payment_id = p.id
WHERE a.code = '2000'
  AND p.contact_id = 'CUSTOMER_UUID_HERE'
  AND jel.credit > 0;
*/
