-- ============================================================================
-- PHASE 1: SINGLE SOURCE OF TRUTH CONFIRMATION
-- ============================================================================
-- Verify that journal_entries.entry_no is unique and exists

-- Check if entry_no exists for a specific reference
SELECT
  id,
  entry_no,
  reference_type,
  reference_id,
  payment_id,
  description,
  created_at
FROM journal_entries
WHERE entry_no = 'JE-0066'
   OR entry_no ILIKE 'JE-0066'
ORDER BY created_at DESC;

-- Check for duplicate entry_no values (should be 0)
SELECT
  entry_no,
  COUNT(*) as count
FROM journal_entries
WHERE entry_no IS NOT NULL
  AND entry_no != ''
GROUP BY entry_no
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- ============================================================================
-- PHASE 2: PAYMENT JOURNAL ENTRY → CUSTOMER LINK CHECK
-- ============================================================================
-- Verify that payment journal entries are properly linked to customers

SELECT
  je.id AS journal_entry_id,
  je.entry_no,
  je.reference_type,
  je.payment_id,
  p.id AS payment_id_verify,
  p.contact_id AS payment_contact_id,
  p.reference_number AS payment_ref,
  p.sale_id AS payment_sale_id,
  s.customer_id AS sale_customer_id,
  s.invoice_no,
  -- Determine resolved customer ID
  CASE 
    WHEN p.contact_id IS NOT NULL THEN p.contact_id
    WHEN s.customer_id IS NOT NULL THEN s.customer_id
    ELSE NULL
  END AS resolved_customer_id
FROM journal_entries je
LEFT JOIN payments p ON je.payment_id = p.id
LEFT JOIN sales s ON (p.sale_id = s.id OR (je.reference_id = s.id AND je.reference_type = 'sale'))
WHERE je.payment_id IS NOT NULL
ORDER BY je.created_at DESC
LIMIT 20;

-- Check for payment entries with NULL customer linkage
SELECT
  je.id AS journal_entry_id,
  je.entry_no,
  je.payment_id,
  p.contact_id,
  p.sale_id,
  s.customer_id
FROM journal_entries je
LEFT JOIN payments p ON je.payment_id = p.id
LEFT JOIN sales s ON p.sale_id = s.id
WHERE je.payment_id IS NOT NULL
  AND (p.contact_id IS NULL AND (p.sale_id IS NULL OR s.customer_id IS NULL))
ORDER BY je.created_at DESC;

-- ============================================================================
-- PHASE 3: CUSTOMER LEDGER DATA VERIFICATION
-- ============================================================================
-- For a specific customer, verify what journal entries should appear
-- Replace 'CUSTOMER_UUID_HERE' with actual customer UUID

/*
SELECT
  'SALES ENTRIES' AS entry_type,
  je.id AS journal_entry_id,
  je.entry_no,
  jel.debit,
  jel.credit,
  s.invoice_no,
  s.customer_id
FROM journal_entries je
JOIN journal_entry_lines jel ON je.id = jel.journal_entry_id
JOIN accounts a ON jel.account_id = a.id
LEFT JOIN sales s ON je.reference_id = s.id AND je.reference_type = 'sale'
WHERE a.code = '2000'  -- Accounts Receivable
  AND s.customer_id = 'CUSTOMER_UUID_HERE'
  AND jel.debit > 0

UNION ALL

SELECT
  'PAYMENT ENTRIES' AS entry_type,
  je.id AS journal_entry_id,
  je.entry_no,
  jel.debit,
  jel.credit,
  p.reference_number AS invoice_no,
  p.contact_id AS customer_id
FROM journal_entries je
JOIN journal_entry_lines jel ON je.id = jel.journal_entry_id
JOIN accounts a ON jel.account_id = a.id
LEFT JOIN payments p ON je.payment_id = p.id
WHERE a.code = '2000'  -- Accounts Receivable
  AND p.contact_id = 'CUSTOMER_UUID_HERE'
  AND jel.credit > 0

ORDER BY journal_entry_id;
*/

-- ============================================================================
-- PHASE 4: SUMMARY CALCULATION VERIFICATION
-- ============================================================================
-- Calculate what totals SHOULD be for a customer
-- Replace 'CUSTOMER_UUID_HERE' with actual customer UUID

/*
SELECT
  'TOTAL CHARGES (DEBIT)' AS metric,
  SUM(jel.debit) AS amount
FROM journal_entries je
JOIN journal_entry_lines jel ON je.id = jel.journal_entry_id
JOIN accounts a ON jel.account_id = a.id
LEFT JOIN sales s ON je.reference_id = s.id AND je.reference_type = 'sale'
WHERE a.code = '2000'
  AND s.customer_id = 'CUSTOMER_UUID_HERE'
  AND jel.debit > 0

UNION ALL

SELECT
  'TOTAL PAYMENTS (CREDIT)' AS metric,
  SUM(jel.credit) AS amount
FROM journal_entries je
JOIN journal_entry_lines jel ON je.id = jel.journal_entry_id
JOIN accounts a ON jel.account_id = a.id
LEFT JOIN payments p ON je.payment_id = p.id
WHERE a.code = '2000'
  AND p.contact_id = 'CUSTOMER_UUID_HERE'
  AND jel.credit > 0;
*/

-- ============================================================================
-- PHASE 5: REFERENCE NUMBER INTEGRITY CHECK
-- ============================================================================
-- Check if reference numbers are properly stored and unique

SELECT
  entry_no,
  COUNT(*) as count,
  STRING_AGG(id::TEXT, ', ') as journal_entry_ids
FROM journal_entries
WHERE entry_no IS NOT NULL
  AND entry_no != ''
GROUP BY entry_no
HAVING COUNT(*) > 1;

-- Check for entries with missing or invalid entry_no
SELECT
  id,
  entry_no,
  reference_type,
  payment_id,
  reference_id,
  description,
  created_at
FROM journal_entries
WHERE entry_no IS NULL 
   OR entry_no = ''
   OR entry_no ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   OR LENGTH(entry_no) > 50
ORDER BY created_at DESC
LIMIT 50;

-- ============================================================================
-- PHASE 6: JOURNAL ENTRY → ACCOUNT LINKAGE VERIFICATION
-- ============================================================================
-- Verify that all journal entries for AR account have proper customer linkage

SELECT
  je.id AS journal_entry_id,
  je.entry_no,
  je.reference_type,
  je.payment_id,
  je.reference_id,
  jel.debit,
  jel.credit,
  a.code AS account_code,
  a.name AS account_name,
  -- Customer linkage check
  CASE
    WHEN je.reference_type = 'sale' THEN
      (SELECT customer_id FROM sales WHERE id = je.reference_id)
    WHEN je.payment_id IS NOT NULL THEN
      (SELECT contact_id FROM payments WHERE id = je.payment_id)
    ELSE NULL
  END AS customer_id
FROM journal_entries je
JOIN journal_entry_lines jel ON je.id = jel.journal_entry_id
JOIN accounts a ON jel.account_id = a.id
WHERE a.code = '2000'  -- Accounts Receivable
ORDER BY je.created_at DESC
LIMIT 30;
