-- ============================================================================
-- Expense payment gap: JEs with reference_type expense touching payment account but no payment_id
-- Company: eb71d817-b87e-4195-964b-7b5321b480f5
-- These should have a payments row (reference_type = expense) and journal_entries.payment_id set.
-- ============================================================================

WITH payment_accounts AS (
  SELECT id, code, name
  FROM accounts
  WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
    AND (code IN ('1000', '1010', '1020')
         OR LOWER(COALESCE(name, '')) LIKE '%cash%'
         OR LOWER(COALESCE(name, '')) LIKE '%bank%'
         OR LOWER(COALESCE(name, '')) LIKE '%wallet%')
)
SELECT
  je.id,
  je.entry_no,
  je.entry_date,
  je.reference_type,
  je.reference_id AS expense_id,
  je.payment_id,
  je.description
FROM journal_entries je
JOIN journal_entry_lines l ON l.journal_entry_id = je.id
JOIN payment_accounts pa ON pa.id = l.account_id
WHERE je.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND LOWER(COALESCE(je.reference_type, '')) IN ('expense', 'extra_expense', 'test_expense')
  AND je.payment_id IS NULL
GROUP BY je.id, je.entry_no, je.entry_date, je.reference_type, je.reference_id, je.payment_id, je.description
ORDER BY je.entry_date DESC, je.entry_no DESC;
