-- ============================================================================
-- STEP 4: SQL VERIFICATION QUERY
-- ============================================================================
-- Run this in Supabase SQL Editor to verify journal entry integrity

-- Check for entries where BOTH debit and credit are > 0 (DATA CORRUPTION)
SELECT 
  id,
  entry_no,
  description,
  debit,
  credit,
  reference_type,
  payment_id,
  reference_id,
  created_at
FROM journal_entries je
JOIN journal_entry_lines jel ON je.id = jel.journal_entry_id
JOIN accounts a ON jel.account_id = a.id
WHERE a.code = '2000'  -- Accounts Receivable
  AND jel.debit > 0 
  AND jel.credit > 0
ORDER BY je.created_at DESC;

-- Expected: 0 rows (if data is correct)

-- ============================================================================
-- STEP 3: BACKEND JOURNAL ENTRY RULE VERIFICATION
-- ============================================================================
-- Verify that journal entries follow accounting rules for AR account

-- Sales should be DEBIT
SELECT 
  'SALES (Should be DEBIT)' AS check_type,
  COUNT(*) AS count,
  SUM(jel.debit) AS total_debit,
  SUM(jel.credit) AS total_credit
FROM journal_entries je
JOIN journal_entry_lines jel ON je.id = jel.journal_entry_id
JOIN accounts a ON jel.account_id = a.id
WHERE a.code = '2000'  -- Accounts Receivable
  AND je.reference_type = 'sale'
  AND jel.debit > 0;

-- Payments should be CREDIT
SELECT 
  'PAYMENTS (Should be CREDIT)' AS check_type,
  COUNT(*) AS count,
  SUM(jel.debit) AS total_debit,
  SUM(jel.credit) AS total_credit
FROM journal_entries je
JOIN journal_entry_lines jel ON je.id = jel.journal_entry_id
JOIN accounts a ON jel.account_id = a.id
WHERE a.code = '2000'  -- Accounts Receivable
  AND je.payment_id IS NOT NULL
  AND jel.credit > 0;

-- ============================================================================
-- STEP 5: PAYMENT ENTRY SOURCE VERIFICATION
-- ============================================================================
-- Check if payments are properly linked to journal entries

SELECT 
  p.id AS payment_id,
  p.reference_number,
  p.journal_entry_id,
  p.contact_id,
  p.amount,
  CASE 
    WHEN p.journal_entry_id IS NULL THEN 'MISSING JOURNAL ENTRY'
    ELSE 'LINKED'
  END AS status
FROM payments p
WHERE p.journal_entry_id IS NULL
ORDER BY p.created_at DESC
LIMIT 20;

-- Expected: 0 rows (all payments should have journal_entry_id)

-- ============================================================================
-- STEP 8: FINAL SANITY CHECK
-- ============================================================================
-- Example: Sale 1000 (DEBIT) + Payment 400 (CREDIT) = Balance 600

-- For a specific customer, verify the calculation
-- Replace 'CUSTOMER_UUID_HERE' with actual customer UUID

/*
SELECT 
  'Sale Entry' AS entry_type,
  je.entry_no,
  jel.debit,
  jel.credit,
  jel.debit - jel.credit AS net_effect
FROM journal_entries je
JOIN journal_entry_lines jel ON je.id = jel.journal_entry_id
JOIN accounts a ON jel.account_id = a.id
JOIN sales s ON je.reference_id = s.id AND je.reference_type = 'sale'
WHERE a.code = '2000'
  AND s.customer_id = 'CUSTOMER_UUID_HERE'
  AND jel.debit > 0

UNION ALL

SELECT 
  'Payment Entry' AS entry_type,
  je.entry_no,
  jel.debit,
  jel.credit,
  jel.debit - jel.credit AS net_effect
FROM journal_entries je
JOIN journal_entry_lines jel ON je.id = jel.journal_entry_id
JOIN accounts a ON jel.account_id = a.id
JOIN payments p ON je.payment_id = p.id
WHERE a.code = '2000'
  AND p.contact_id = 'CUSTOMER_UUID_HERE'
  AND jel.credit > 0

ORDER BY entry_type, entry_no;
*/
