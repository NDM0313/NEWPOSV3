-- ============================================================================
-- Manual Entry Payment Account Classification (Phase-3)
-- Company: eb71d817-b87e-4195-964b-7b5321b480f5
-- Classifies manual journal entries into:
--   (A) Payment movement: at least one line touches a payment account (Cash/Bank/Wallet)
--   (B) Pure journal: no payment account involved
-- And whether they have a linked payments row (should for A, not for B).
-- ============================================================================

WITH payment_accounts AS (
  SELECT id
  FROM accounts
  WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
    AND (code IN ('1000', '1010', '1020')
         OR LOWER(COALESCE(name, '')) LIKE '%cash%'
         OR LOWER(COALESCE(name, '')) LIKE '%bank%'
         OR LOWER(COALESCE(name, '')) LIKE '%wallet%')
),
manual_jes AS (
  SELECT je.id, je.entry_no, je.entry_date, je.reference_type, je.payment_id, je.description, je.created_at
  FROM journal_entries je
  WHERE je.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
    AND (LOWER(COALESCE(je.reference_type, '')) IN ('manual', 'manual_receipt', 'manual_payment'))
),
has_payment_account AS (
  SELECT jel.journal_entry_id
  FROM journal_entry_lines jel
  JOIN payment_accounts pa ON pa.id = jel.account_id
  JOIN manual_jes j ON j.id = jel.journal_entry_id
  GROUP BY jel.journal_entry_id
)
SELECT
  j.id AS journal_entry_id,
  j.entry_no,
  j.entry_date,
  j.reference_type,
  j.payment_id,
  CASE WHEN h.journal_entry_id IS NOT NULL THEN 'payment_movement' ELSE 'pure_journal' END AS classification,
  CASE
    WHEN h.journal_entry_id IS NOT NULL AND j.payment_id IS NOT NULL THEN 'OK (in Roznamcha)'
    WHEN h.journal_entry_id IS NOT NULL AND j.payment_id IS NULL THEN 'GAP (should have payment row)'
    WHEN h.journal_entry_id IS NULL THEN 'OK (journal only, no Roznamcha)'
  END AS status,
  j.description,
  j.created_at
FROM manual_jes j
LEFT JOIN has_payment_account h ON h.journal_entry_id = j.id
ORDER BY j.entry_date DESC, j.created_at DESC;
