-- Verification queries for component-level accounting edit engine.
-- Run against your company_id / purchase_id / sale_id as needed.

-- 1) List journal entries for a purchase (main + adjustments; payment JEs are separate)
-- Replace :purchase_id and :company_id with actual values.
/*
SELECT id, entry_no, entry_date, description, reference_type, reference_id, created_at
FROM journal_entries
WHERE company_id = :company_id
  AND (reference_id = :purchase_id AND reference_type IN ('purchase', 'purchase_adjustment'))
ORDER BY entry_date, created_at;
*/

-- 2) List payment journal entries for a purchase (reference_type = 'payment', reference_id = payment.id; link via payments.reference_id = purchase_id)
/*
SELECT je.id, je.entry_no, je.reference_type, je.reference_id, p.reference_id AS purchase_id, p.amount
FROM journal_entries je
JOIN payments p ON p.id = je.reference_id AND je.reference_type = 'payment'
WHERE p.reference_type = 'purchase' AND p.reference_id = :purchase_id
  AND je.company_id = :company_id;
*/

-- 3) Supplier ledger entries for a purchase (ledger_entries reference_id = purchase id or payment)
-- Adjust table name if your ledger is ledger_entries with source/reference_no/reference_id.
/*
SELECT le.entry_date, le.debit, le.credit, le.source, le.remarks, le.reference_no
FROM ledger_entries le
JOIN ledger_master lm ON lm.id = le.ledger_id
WHERE lm.ledger_type = 'supplier'
  AND le.reference_id = :purchase_id
  AND le.company_id = :company_id
ORDER BY le.entry_date, le.created_at;
*/

-- 4) Count purchase_adjustment JEs per purchase (should be 0 or more; no full replacement of purchase JE)
/*
SELECT reference_id AS purchase_id, COUNT(*) AS adjustment_count
FROM journal_entries
WHERE company_id = :company_id
  AND reference_type = 'purchase_adjustment'
GROUP BY reference_id;
*/

-- 5) Ensure no duplicate active fingerprints for purchase_adjustment (idempotency)
/*
SELECT action_fingerprint, COUNT(*) AS cnt
FROM journal_entries
WHERE company_id = :company_id
  AND reference_type = 'purchase_adjustment'
  AND (is_void IS NULL OR is_void = false)
  AND action_fingerprint IS NOT NULL
GROUP BY action_fingerprint
HAVING COUNT(*) > 1;
*/
