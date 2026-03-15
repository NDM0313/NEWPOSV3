-- ============================================================================
-- Canonical payment posting verification
-- Company: eb71d817-b87e-4195-964b-7b5321b480f5
-- 1) JEs touching payment account must have payment_id set.
-- 2) payments.reference_type must be one of: sale, purchase, worker_payment, expense, manual_payment, manual_receipt, on_account.
-- 3) No test_* reference_type in journal_entries for money movement.
-- ============================================================================

-- A) JEs that touch a payment account but have payment_id NULL (should be 0 after fix)
WITH payment_accounts AS (
  SELECT id FROM accounts
  WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
    AND (code IN ('1000', '1010', '1020')
         OR LOWER(COALESCE(name, '')) LIKE '%cash%'
         OR LOWER(COALESCE(name, '')) LIKE '%bank%'
         OR LOWER(COALESCE(name, '')) LIKE '%wallet%')
),
jes_touching_payment AS (
  SELECT DISTINCT je.id, je.entry_no, je.payment_id, je.reference_type
  FROM journal_entries je
  JOIN journal_entry_lines l ON l.journal_entry_id = je.id
  JOIN payment_accounts pa ON pa.id = l.account_id
  WHERE je.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
)
SELECT 'JEs touching payment account with payment_id NULL' AS check_name, COUNT(*) AS cnt
FROM jes_touching_payment WHERE payment_id IS NULL
UNION ALL
-- B) journal_entries with test_* reference_type (should be 0 in production posting)
SELECT 'JEs with test_* reference_type', COUNT(*)
FROM journal_entries
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND LOWER(COALESCE(reference_type, '')) LIKE 'test_%'
UNION ALL
-- C) payments with non-canonical reference_type
SELECT 'Payments with non-canonical reference_type', COUNT(*)
FROM payments
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND LOWER(COALESCE(reference_type, '')) NOT IN (
    'sale', 'purchase', 'worker_payment', 'expense',
    'manual_payment', 'manual_receipt', 'on_account'
  );
