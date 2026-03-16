-- ============================================================================
-- Add Entry V2 – Posting verification (run after creating one entry per type)
-- Replace 'REPLACE_WITH_YOUR_COMPANY_UUID' with your company_id for targeted checks.
-- ============================================================================

-- 1) Payments created by Add Entry V2 (by reference_type)
SELECT reference_type, COUNT(*) AS cnt
FROM payments
WHERE company_id = 'REPLACE_WITH_YOUR_COMPANY_UUID'
  AND reference_type IN ('manual_receipt', 'manual_payment', 'worker_payment', 'expense', 'courier_payment')
GROUP BY reference_type;

-- 2) JEs that touch payment account must have payment_id set (V2 payment types)
WITH payment_accounts AS (
  SELECT id FROM accounts
  WHERE company_id = 'REPLACE_WITH_YOUR_COMPANY_UUID'
    AND (LOWER(COALESCE(name, '')) LIKE '%cash%'
         OR LOWER(COALESCE(name, '')) LIKE '%bank%'
         OR LOWER(COALESCE(name, '')) LIKE '%wallet%'
         OR code IN ('1000', '1010', '1020'))
),
jes_touching_payment AS (
  SELECT je.id, je.entry_no, je.payment_id, je.reference_type
  FROM journal_entries je
  JOIN journal_entry_lines l ON l.journal_entry_id = je.id
  JOIN payment_accounts pa ON pa.id = l.account_id
  WHERE je.company_id = 'REPLACE_WITH_YOUR_COMPANY_UUID'
    AND je.reference_type IN ('manual_receipt', 'manual_payment', 'worker_payment', 'expense', 'courier_payment')
)
SELECT 'JEs (V2 payment types) touching payment account with payment_id NULL' AS check_name, COUNT(*) AS cnt
FROM jes_touching_payment WHERE payment_id IS NULL;

-- 3) One-to-one: each payment has exactly one JE
SELECT p.reference_type, p.id AS payment_id, p.reference_number,
       (SELECT COUNT(*) FROM journal_entries je WHERE je.payment_id = p.id) AS je_count
FROM payments p
WHERE p.company_id = 'REPLACE_WITH_YOUR_COMPANY_UUID'
  AND p.reference_type IN ('manual_receipt', 'manual_payment', 'worker_payment', 'expense', 'courier_payment')
  AND (SELECT COUNT(*) FROM journal_entries je WHERE je.payment_id = p.id) <> 1;

-- 4) Supplier ledger: ledger_entries with source = 'payment' and reference_id = payment.id
SELECT lm.ledger_type, lm.entity_id, le.source, le.reference_id, le.debit, le.credit, le.entry_date
FROM ledger_entries le
JOIN ledger_master lm ON lm.id = le.ledger_id
WHERE lm.company_id = 'REPLACE_WITH_YOUR_COMPANY_UUID'
  AND lm.ledger_type = 'supplier'
  AND le.source = 'payment'
ORDER BY le.entry_date DESC
LIMIT 20;

-- 5) Pure journal: no payment row, JE only (reference_type = 'journal')
SELECT je.id, je.entry_no, je.payment_id, je.reference_type
FROM journal_entries je
WHERE je.company_id = 'REPLACE_WITH_YOUR_COMPANY_UUID' AND je.reference_type = 'journal'
ORDER BY je.entry_date DESC
LIMIT 10;

-- 6) Internal transfer: JE only, reference_type = 'transfer', no payment
SELECT je.id, je.entry_no, je.payment_id, je.reference_type
FROM journal_entries je
WHERE je.company_id = 'REPLACE_WITH_YOUR_COMPANY_UUID' AND je.reference_type = 'transfer'
ORDER BY je.entry_date DESC
LIMIT 10;

-- 7) Courier payments: payments + JE with payment_id
SELECT p.id AS payment_id, p.reference_type, p.reference_id AS courier_ref, p.amount, p.reference_number,
       je.id AS journal_entry_id, je.payment_id
FROM payments p
LEFT JOIN journal_entries je ON je.payment_id = p.id
WHERE p.company_id = 'REPLACE_WITH_YOUR_COMPANY_UUID' AND p.reference_type = 'courier_payment'
ORDER BY p.payment_date DESC
LIMIT 10;
