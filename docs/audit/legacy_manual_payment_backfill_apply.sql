-- ============================================================================
-- Legacy Manual Payment Backfill APPLY (Phase 4)
-- Company: eb71d817-b87e-4195-964b-7b5321b480f5
-- Inserts payments rows for manual JEs that have payment account but no payment_id,
-- then links journal_entries.payment_id. Run legacy_manual_payment_backfill_preview.sql first.
-- ============================================================================

WITH payment_accounts AS (
  SELECT id FROM accounts
  WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
    AND (code IN ('1000', '1010', '1020')
         OR LOWER(COALESCE(name, '')) LIKE '%cash%'
         OR LOWER(COALESCE(name, '')) LIKE '%bank%'
         OR LOWER(COALESCE(name, '')) LIKE '%wallet%')
),
manual_jes AS (
  SELECT je.id, je.entry_date, je.branch_id, je.company_id, je.created_by
  FROM journal_entries je
  WHERE je.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
    AND LOWER(COALESCE(je.reference_type, '')) IN ('manual', 'manual_receipt', 'manual_payment')
    AND je.payment_id IS NULL
),
manual_with_payment AS (
  SELECT DISTINCT j.id AS journal_entry_id
  FROM manual_jes j
  JOIN journal_entry_lines l ON l.journal_entry_id = j.id
  JOIN payment_accounts pa ON pa.id = l.account_id
),
je_one_row AS (
  SELECT DISTINCT ON (j.id)
    j.id AS journal_entry_id,
    j.entry_date,
    j.branch_id,
    j.company_id,
    j.created_by,
    jel.account_id AS payment_account_id,
    CASE WHEN jel.debit > 0 THEN jel.debit ELSE jel.credit END AS amount,
    (CASE WHEN jel.debit > 0 THEN 'received' ELSE 'paid' END)::payment_type AS payment_type,
    CASE WHEN jel.debit > 0 THEN 'manual_receipt' ELSE 'manual_payment' END AS reference_type
  FROM manual_jes j
  JOIN manual_with_payment m ON m.journal_entry_id = j.id
  JOIN journal_entry_lines jel ON jel.journal_entry_id = j.id
  JOIN payment_accounts pa ON pa.id = jel.account_id
  WHERE (jel.debit > 0 OR jel.credit > 0)
  ORDER BY j.id, jel.id
),
inserted AS (
  INSERT INTO payments (
    company_id, branch_id, payment_type, reference_type, reference_id,
    amount, payment_method, payment_account_id, payment_date, reference_number,
    received_by, created_by
  )
  SELECT
    jr.company_id,
    jr.branch_id,
    jr.payment_type,
    jr.reference_type,
    NULL,
    jr.amount,
    'other',
    jr.payment_account_id,
    jr.entry_date,
    'PAY-BACKFILL-' || jr.journal_entry_id::text,
    jr.created_by,
    jr.created_by
  FROM je_one_row jr
  RETURNING id, reference_number
)
UPDATE journal_entries je
SET payment_id = ins.id
FROM inserted ins
WHERE je.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND ins.reference_number LIKE 'PAY-BACKFILL-%'
  AND je.id::text = SUBSTRING(ins.reference_number FROM 15);
