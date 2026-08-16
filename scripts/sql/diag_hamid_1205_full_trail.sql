-- Full 1205 HAMID IK RMB journal trail + supplier payment search (DIN CHINA)
\set company_id '30bd8592-3384-4f34-899a-f3907e336485'
\set account_1205 'cbd6a16a-5521-43d5-ba33-01994d47c481'

SELECT '=== All 1205 lines (active) ===' AS section;
SELECT je.entry_no, je.entry_date, je.reference_type, je.description,
       ROUND(jel.debit::numeric, 2) AS dr,
       ROUND(jel.credit::numeric, 2) AS cr
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
WHERE jel.account_id = :'account_1205'::uuid
  AND je.company_id = :'company_id'::uuid
  AND COALESCE(je.is_void, false) = false
ORDER BY je.entry_date, je.entry_no;

SELECT '=== 1205 net ===' AS section;
SELECT ROUND(COALESCE(SUM(jel.debit - jel.credit), 0)::numeric, 2) AS net_dr_minus_cr
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
WHERE jel.account_id = :'account_1205'::uuid
  AND COALESCE(je.is_void, false) = false;

SELECT '=== JEs mentioning HAMID (all accounts) ===' AS section;
SELECT je.entry_no, je.entry_date, je.reference_type, je.description, je.is_void,
       ROUND(COALESCE(je.total_debit, 0)::numeric, 2) AS amount
FROM journal_entries je
WHERE je.company_id = :'company_id'::uuid
  AND (je.description ILIKE '%hamid%' OR je.description ILIKE '%HAMID%')
ORDER BY je.entry_date, je.entry_no;

SELECT '=== Payments linked to HAMID contact or 1205 ===' AS section;
SELECT p.id, p.payment_date, p.payment_type, p.reference_type, p.amount,
       pa.code AS pay_acct, pa.name AS pay_acct_name, c.name AS contact_name, p.notes
FROM payments p
LEFT JOIN accounts pa ON pa.id = p.payment_account_id
LEFT JOIN contacts c ON c.id = p.contact_id
WHERE p.company_id = :'company_id'::uuid
  AND (
    p.contact_id IN (SELECT id FROM contacts WHERE company_id = :'company_id'::uuid AND UPPER(name) LIKE '%HAMID%')
    OR p.payment_account_id = :'account_1205'::uuid
    OR p.reference_id = :'account_1205'::uuid
    OR p.notes ILIKE '%hamid%'
  )
ORDER BY p.payment_date;

SELECT '=== Supplier payments ~921691 Dec 2025 ===' AS section;
SELECT je.entry_no, je.entry_date, je.reference_type, je.description,
       a.code, a.name, ROUND(jel.debit::numeric, 2) AS dr, ROUND(jel.credit::numeric, 2) AS cr
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN accounts a ON a.id = jel.account_id
WHERE je.company_id = :'company_id'::uuid
  AND COALESCE(je.is_void, false) = false
  AND je.entry_date BETWEEN '2025-11-01' AND '2025-12-31'
  AND ABS(COALESCE(je.total_debit, 0) - 921691) < 2
ORDER BY je.entry_date, je.entry_no, jel.debit DESC;
