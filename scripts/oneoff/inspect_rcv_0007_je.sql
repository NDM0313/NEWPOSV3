SELECT je.id, je.entry_no, je.payment_id, je.reference_type, je.is_void
FROM journal_entries je
WHERE je.payment_id = 'b8f4f9bc-5ed5-4827-9244-9443c47351c1';

SELECT id, reference_number, voided_at, amount, payment_account_id
FROM payments WHERE reference_number = 'RCV-0007';
