-- Roznamcha visibility diagnostic for REN-0002 10k on 2026-06-04
SELECT rp.id, rp.reference, rp.payment_date, rp.amount, rp.payment_account_id,
       rp.journal_entry_id, rp.voided_at, a.name, a.type, a.code,
       r.booking_no, r.branch_id, b.name AS branch_name
FROM rental_payments rp
JOIN rentals r ON r.id = rp.rental_id
LEFT JOIN accounts a ON a.id = rp.payment_account_id
LEFT JOIN branches b ON b.id = r.branch_id
WHERE r.booking_no = 'REN-0002'
ORDER BY rp.payment_date, rp.created_at;

SELECT id, payment_date, amount, payment_account_id, reference_type, reference_number, branch_id, voided_at
FROM payments
WHERE reference_id = 'dd23f9b3-546c-407c-8e5c-afda407dd882'
   OR reference_number = 'RCV-0007'
ORDER BY payment_date;

SELECT entry_no, id, entry_date, branch_id, is_void, payment_id, description
FROM journal_entries
WHERE entry_no IN ('JE-0011', 'RCV-0007')
   OR id = '2655a04a-3323-4e7a-8496-42b0fa4d88e7';
