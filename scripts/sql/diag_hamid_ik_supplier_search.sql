\set company_id '30bd8592-3384-4f34-899a-f3907e336485'

SELECT name, type FROM contacts WHERE company_id = :'company_id'::uuid AND name ILIKE '%IK%' ORDER BY name LIMIT 30;

SELECT po_no, supplier_name, total, paid_amount, due_amount FROM purchases
WHERE company_id = :'company_id'::uuid AND supplier_name ILIKE '%HAMID%' LIMIT 10;

SELECT je.entry_no, je.entry_date, je.reference_type, je.description
FROM journal_entries je
WHERE je.company_id = :'company_id'::uuid AND je.entry_no IN ('JE-0234','JE-0002','JE-0308')
ORDER BY je.entry_no;

-- Ledger V2: what shows 921691 debit on opening_balance_account
SELECT je.entry_no, je.reference_type, a.code, jel.debit, jel.credit
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN accounts a ON a.id = jel.account_id
WHERE je.id = 'e1a9ff4b-ae8f-482c-b120-8081a2456bb8'::uuid;
