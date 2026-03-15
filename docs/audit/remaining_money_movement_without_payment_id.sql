-- ============================================================================
-- Remaining money movement JEs without payment_id (Roznamcha gap)
-- Company: eb71d817-b87e-4195-964b-7b5321b480f5
-- Any journal entry that touches Cash/Bank/Wallet but has payment_id NULL.
-- ============================================================================

WITH payment_accounts AS (
  SELECT id, code, name
  FROM accounts
  WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
    AND (code IN ('1000', '1010', '1020')
         OR LOWER(COALESCE(name, '')) LIKE '%cash%'
         OR LOWER(COALESCE(name, '')) LIKE '%bank%'
         OR LOWER(COALESCE(name, '')) LIKE '%wallet%')
),
jes_touching_payment AS (
  SELECT DISTINCT je.id
  FROM journal_entries je
  JOIN journal_entry_lines l ON l.journal_entry_id = je.id
  JOIN payment_accounts pa ON pa.id = l.account_id
  WHERE je.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
    AND je.payment_id IS NULL
)
SELECT
  je.id,
  je.entry_no,
  je.entry_date,
  je.reference_type,
  je.reference_id,
  je.payment_id,
  je.description
FROM journal_entries je
JOIN jes_touching_payment j ON j.id = je.id
ORDER BY je.entry_date DESC, je.entry_no DESC;
