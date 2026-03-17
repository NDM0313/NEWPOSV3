-- PF-02 Verification: Purchase Edit Re-Post
-- Run for a given purchase_id and company_id to verify:
-- - Exactly one JE for the purchase (reference_type='purchase', reference_id=id)
-- - JE lines sum (AP credit) matches purchase.total
-- - Supplier ledger net for this purchase matches expected (total - paid - discount)
--
-- NEW BUSINESS ID: c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee
-- OLD BUSINESS ID: eb71d817-b87e-4195-964b-7b5321b480f5
-- In Supabase SQL editor: replace '@purchase_id' and '@company_id' with quoted UUIDs, e.g. 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee'.

-- 1) Purchase row (current total/paid/discount)
SELECT id, po_no, total, paid_amount, discount_amount, status, company_id, supplier_id, supplier_name
FROM purchases
WHERE id = '@purchase_id';

-- 2) Journal entries for this purchase (should be 1 after edit)
SELECT je.id, je.entry_date, je.description, je.reference_type, je.reference_id,
       (SELECT SUM(credit - debit) FROM journal_entry_lines WHERE journal_entry_id = je.id) AS net_ap_effect
FROM journal_entries je
WHERE je.reference_type = 'purchase' AND je.reference_id = '@purchase_id';

-- 3) JE lines (AP side) — credit should match purchase total (items + charges)
SELECT jel.id, a.name AS account_name, jel.debit, jel.credit, jel.description
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN accounts a ON a.id = jel.account_id
WHERE je.reference_type = 'purchase' AND je.reference_id = '@purchase_id'
ORDER BY je.id, jel.id;

-- 4) Supplier ledger entries for this purchase (reference_id = purchase id)
SELECT le.id, le.entry_date, le.debit, le.credit, le.source, le.reference_no, le.remarks
FROM ledger_entries le
JOIN ledger_master lm ON lm.id = le.ledger_id
WHERE le.reference_id = '@purchase_id'
  AND lm.company_id = '@company_id'
ORDER BY le.entry_date, le.created_at;

-- 5) Count check: any purchase with more than one JE (should be empty after PF-02)
SELECT reference_id AS purchase_id, COUNT(*) AS je_count
FROM journal_entries
WHERE reference_type = 'purchase'
  AND company_id = '@company_id'
GROUP BY reference_id
HAVING COUNT(*) > 1;
