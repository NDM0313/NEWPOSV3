SELECT id, name, type, code FROM accounts
WHERE id IN ('1c6ee483-95a4-4b49-95fd-cb7505a866d4', '75695b61-c0eb-4c9b-84bb-d0e77551d37e');

SELECT p.id, p.reference_number, p.amount, p.payment_date, p.payment_account_id, p.journal_entry_id,
       je.entry_no, je.payment_id
FROM payments p
LEFT JOIN journal_entries je ON je.payment_id = p.id
WHERE p.id = 'b8f4f9bc-5ed5-4827-9244-9443c47351c1';

SELECT je.entry_no, je.id, je.payment_id, je.branch_id
FROM journal_entries je
WHERE je.id = '2655a04a-3323-4e7a-8496-42b0fa4d88e7';
