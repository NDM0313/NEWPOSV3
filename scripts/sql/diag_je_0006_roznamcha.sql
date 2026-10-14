-- JE-0006 diagnosis (read-only)
SELECT je.id, je.entry_no, je.entry_date, je.reference_type, je.payment_id, je.branch_id, je.company_id,
       c.name AS company_name, jel.debit, jel.credit, a.name, a.code, a.type
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN accounts a ON a.id = jel.account_id
LEFT JOIN companies c ON c.id = je.company_id
WHERE je.entry_no = 'JE-0006'
ORDER BY je.company_id, jel.debit DESC;

SELECT p.payment_type, p.amount, p.payment_account_id, a.name, a.code, p.reference_id, p.reference_number, p.company_id
FROM payments p
LEFT JOIN accounts a ON a.id = p.payment_account_id
WHERE p.reference_number = 'JE-0006'
   OR p.reference_id IN (SELECT id FROM journal_entries WHERE entry_no = 'JE-0006');
