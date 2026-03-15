-- ============================================================================
-- Legacy Manual Payment Backfill PREVIEW (Phase 4)
-- Company: eb71d817-b87e-4195-964b-7b5321b480f5
-- Manual JEs that involve a payment account but have no payments row (Roznamcha gap).
-- Lists what would be inserted into payments and which journal_entries would get payment_id.
-- Apply script will INSERT payments + UPDATE journal_entries; run preview first.
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
manual_jes AS (
  SELECT je.id, je.entry_no, je.entry_date, je.description, je.reference_type, je.payment_id, je.branch_id, je.company_id, je.created_by
  FROM journal_entries je
  WHERE je.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
    AND LOWER(COALESCE(je.reference_type, '')) IN ('manual', 'manual_receipt', 'manual_payment')
    AND je.payment_id IS NULL
),
-- Which manual JEs have a payment account in their lines
manual_with_payment AS (
  SELECT DISTINCT j.id AS journal_entry_id
  FROM manual_jes j
  JOIN journal_entry_lines l ON l.journal_entry_id = j.id
  JOIN payment_accounts pa ON pa.id = l.account_id
),
-- One row per gap JE: payment account, amount, type (from first payment-account line)
je_one_row AS (
  SELECT DISTINCT ON (j.id)
    j.id AS journal_entry_id,
    j.entry_date,
    j.branch_id,
    j.company_id,
    j.created_by,
    jel.account_id AS payment_account_id,
    CASE WHEN jel.debit > 0 THEN jel.debit ELSE jel.credit END AS amount,
    CASE WHEN jel.debit > 0 THEN 'received' ELSE 'paid' END AS payment_type,
    CASE WHEN jel.debit > 0 THEN 'manual_receipt' ELSE 'manual_payment' END AS reference_type
  FROM manual_jes j
  JOIN manual_with_payment m ON m.journal_entry_id = j.id
  JOIN journal_entry_lines jel ON jel.journal_entry_id = j.id
  JOIN payment_accounts pa ON pa.id = jel.account_id
  WHERE (jel.debit > 0 OR jel.credit > 0)
  ORDER BY j.id, jel.id
)
SELECT
  jr.journal_entry_id,
  jr.entry_date AS payment_date,
  jr.amount,
  jr.payment_type,
  jr.reference_type,
  jr.payment_account_id,
  'PAY-BACKFILL-' || jr.journal_entry_id::text AS proposed_reference_number,
  'Will INSERT payment + UPDATE journal_entries.payment_id' AS action
FROM je_one_row jr
ORDER BY jr.entry_date DESC, jr.journal_entry_id;
