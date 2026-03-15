-- ============================================================================
-- Manual Entry Roznamcha Gap (Phase-3)
-- Company: eb71d817-b87e-4195-964b-7b5321b480f5
-- Finds manual journal entries that involve a payment account (Cash/Bank/Wallet)
-- but have no linked payments row (so they do not appear in Roznamcha).
-- ============================================================================

-- Payment account codes: 1000 Cash, 1010 Bank, 1020 Mobile Wallet
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
  SELECT je.id, je.entry_no, je.entry_date, je.description, je.reference_type, je.payment_id, je.created_at
  FROM journal_entries je
  WHERE je.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
    AND LOWER(COALESCE(je.reference_type, '')) IN ('manual', 'manual_receipt', 'manual_payment')
),
manual_je_lines AS (
  SELECT jel.journal_entry_id, jel.account_id, jel.debit, jel.credit
  FROM journal_entry_lines jel
  JOIN manual_jes je ON je.id = jel.journal_entry_id
),
manual_with_payment_account AS (
  SELECT DISTINCT j.id AS journal_entry_id
  FROM manual_jes j
  JOIN manual_je_lines l ON l.journal_entry_id = j.id
  JOIN payment_accounts pa ON pa.id = l.account_id
)
SELECT
  j.id AS journal_entry_id,
  j.entry_no,
  j.entry_date,
  j.reference_type,
  j.payment_id,
  j.description,
  j.created_at
FROM manual_jes j
JOIN manual_with_payment_account m ON m.journal_entry_id = j.id
WHERE j.payment_id IS NULL
ORDER BY j.entry_date DESC, j.created_at DESC;
