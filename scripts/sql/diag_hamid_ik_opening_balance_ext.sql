\set company_id '30bd8592-3384-4f34-899a-f3907e336485'

SELECT '=== suppliers HAMID ===' AS section;
SELECT id, name, type, opening_balance FROM contacts
WHERE company_id = :'company_id'::uuid AND name ILIKE '%HAMID%';

SELECT '=== AP accounts HAMID ===' AS section;
SELECT a.id, a.code, a.name, a.balance, a.contact_id, c.name
FROM accounts a
LEFT JOIN contacts c ON c.id = a.contact_id
WHERE a.company_id = :'company_id'::uuid AND (a.name ILIKE '%HAMID%' OR c.name ILIKE '%HAMID%');

SELECT '=== JE-0308 full lines ===' AS section;
SELECT a.code, a.name, jel.debit, jel.credit, jel.description
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN accounts a ON a.id = jel.account_id
WHERE je.entry_no = 'JE-0308';

SELECT '=== JE-0002 payment row ===' AS section;
SELECT p.*, je.reference_type, je.description
FROM payments p
JOIN journal_entries je ON je.payment_id = p.id
WHERE je.entry_no = 'JE-0002';

SELECT '=== JE-0234 transfer ===' AS section;
SELECT je.id, je.entry_date, je.description, a.code, jel.debit, jel.credit
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN accounts a ON a.id = jel.account_id
WHERE je.entry_no = 'JE-0234'
ORDER BY jel.debit DESC;

SELECT '=== 1205 net journal ===' AS section;
SELECT ROUND(SUM(jel.debit - jel.credit)::numeric, 2) AS net_1205
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
WHERE jel.account_id = 'cbd6a16a-5521-43d5-ba33-01994d47c481'::uuid
  AND COALESCE(je.is_void, false) = false;

SELECT '=== 3000 Owner Capital net on opening lines ===' AS section;
SELECT je.entry_no, ROUND(jel.debit::numeric,2) AS dr
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
WHERE jel.account_id IN (SELECT id FROM accounts WHERE company_id = :'company_id'::uuid AND code = '3000')
  AND je.reference_type ILIKE '%opening%'
  AND COALESCE(je.is_void, false) = false
  AND ABS(jel.debit - 921691) < 1;
