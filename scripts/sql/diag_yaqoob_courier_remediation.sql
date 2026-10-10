-- YAQOOB courier / clearance remediation — read-only diagnosis (DIN CHINA)
-- Run:
--   Get-Content scripts/sql/diag_yaqoob_courier_remediation.sql -Raw | ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres"
--
-- Mandatory before apply: pg_dump company-scoped snapshot (see repair script header).

\set company_id '30bd8592-3384-4f34-899a-f3907e336485'
\set yaqoob_bank_id 'f08ae0ee-a156-4c6c-8607-4b02f0cc15fe'
\set purchase_id 'a065035c-dca2-4079-837a-9c2aeca9332d'
\set ap_account_id 'ce35ae9e-de68-4be0-ae84-8c99463a1011'

SELECT '=== 1. Wrong pseudo-bank YAQOOB 1204 ===' AS section;
SELECT id, code, name, type, balance, is_active, contact_id
FROM accounts
WHERE id = :'yaqoob_bank_id'::uuid;

SELECT '=== 2. Courier master (expect 0 before repair) ===' AS section;
SELECT c.id, c.name, c.type, co.id AS courier_row_id, co.account_id
FROM contacts c
LEFT JOIN couriers co ON co.contact_id = c.id AND co.company_id = c.company_id
WHERE c.company_id = :'company_id'::uuid
  AND UPPER(TRIM(c.name)) = 'YAQOOB';

SELECT '=== 3. Purchase PO2025/0003 ===' AS section;
SELECT id, po_no, total, paid_amount, due_amount, shipping_cost, supplier_id
FROM purchases
WHERE id = :'purchase_id'::uuid;

SELECT '=== 4. Supplier payments (PAY-0005..8) ===' AS section;
SELECT p.id, je.document_no, je.entry_no, p.amount, p.reference_type,
       p.payment_account_id, pa.code AS pay_acct_code, pa.name AS pay_acct_name,
       p.contact_id, p.reference_id
FROM payments p
JOIN journal_entries je ON je.payment_id = p.id
LEFT JOIN accounts pa ON pa.id = p.payment_account_id
WHERE p.company_id = :'company_id'::uuid
  AND je.document_no IN ('PAY-0005', 'PAY-0006', 'PAY-0007', 'PAY-0008')
ORDER BY je.document_no;

SELECT '=== 5. YAQOOB account JE activity (non-void) ===' AS section;
SELECT je.reference_type, COUNT(*) AS je_count,
       ROUND(COALESCE(SUM(jel.debit), 0)::numeric, 2) AS yaqoob_dr,
       ROUND(COALESCE(SUM(jel.credit), 0)::numeric, 2) AS yaqoob_cr
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
WHERE je.company_id = :'company_id'::uuid
  AND jel.account_id = :'yaqoob_bank_id'::uuid
  AND COALESCE(je.is_void, false) = false
GROUP BY je.reference_type
ORDER BY je.reference_type;

SELECT '=== 6. Transfer → YAQOOB bank credit tie-out (source banks) ===' AS section;
SELECT a.id, a.code, a.name,
       ROUND(COALESCE(SUM(jel.credit), 0)::numeric, 2) AS bank_credits_from_yaqoob_transfers
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN accounts a ON a.id = jel.account_id
WHERE je.company_id = :'company_id'::uuid
  AND COALESCE(je.is_void, false) = false
  AND je.reference_type = 'transfer'
  AND jel.credit > 0
  AND EXISTS (
    SELECT 1 FROM journal_entry_lines y
    WHERE y.journal_entry_id = je.id
      AND y.account_id = :'yaqoob_bank_id'::uuid
      AND y.debit > 0
  )
GROUP BY a.id, a.code, a.name
ORDER BY bank_credits_from_yaqoob_transfers DESC;

SELECT '=== 7. PAY-0005/6/7 GL lines (wrong AP + YAQOOB) ===' AS section;
SELECT je.document_no, je.entry_date, a.code, a.name, jel.debit, jel.credit
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN accounts a ON a.id = jel.account_id
WHERE je.company_id = :'company_id'::uuid
  AND je.document_no IN ('PAY-0005', 'PAY-0006', 'PAY-0007')
ORDER BY je.document_no, jel.debit DESC;

SELECT '=== 8. Supplier AP balance (expect ~26.6M credit after repair) ===' AS section;
SELECT a.code, a.name, a.balance
FROM accounts a
WHERE a.id = :'ap_account_id'::uuid;

SELECT '=== 9. Courier payable control / 2031 slot ===' AS section;
SELECT id, code, name, balance, contact_id, parent_id, is_active
FROM accounts
WHERE company_id = :'company_id'::uuid
  AND (code = '2030' OR code ~ '^203[0-9]+$')
ORDER BY code;

SELECT '=== 10. purchase_charges on PO2025/0003 ===' AS section;
SELECT *
FROM purchase_charges
WHERE purchase_id = :'purchase_id'::uuid;

SELECT '=== 11. Net YAQOOB 1204 (target 0 after repair) ===' AS section;
SELECT ROUND(COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0), 2) AS yaqoob_net_balance
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
WHERE je.company_id = :'company_id'::uuid
  AND jel.account_id = :'yaqoob_bank_id'::uuid
  AND COALESCE(je.is_void, false) = false;

SELECT '=== 12. Supplier AP split gates (after clearance AP repair) ===' AS section;
SELECT p.due_amount,
       ROUND(p.subtotal - COALESCE(p.discount_amount, 0) + COALESCE(p.tax_amount, 0) - COALESCE(p.paid_amount, 0), 2) AS expected_supplier_due,
       p.freight_settlement,
       p.clearance_courier_id
FROM purchases p
WHERE p.id = :'purchase_id'::uuid;

SELECT a.code, a.name, a.balance AS supplier_ap_balance
FROM accounts a
WHERE a.id = :'ap_account_id'::uuid;

SELECT a.code, a.name, a.balance AS yaqoob_2031_balance
FROM accounts a
JOIN couriers co ON co.account_id = a.id
JOIN contacts c ON c.id = co.contact_id
WHERE c.company_id = :'company_id'::uuid
  AND UPPER(TRIM(c.name)) = 'YAQOOB'
  AND c.type = 'courier';
