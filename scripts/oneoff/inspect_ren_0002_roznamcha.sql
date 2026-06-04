-- REN-0002 / rental JE-0011 roznamcha diagnostic
SELECT id, booking_no, branch_id, customer_name, paid_amount, total_amount
FROM rentals WHERE booking_no = 'REN-0002';

SELECT id, amount, payment_date, payment_account_id, journal_entry_id, reference, voided_at, created_at
FROM rental_payments
WHERE rental_id = 'dd23f9b3-546c-407c-8e5c-afda407dd882'
ORDER BY payment_date, created_at;

SELECT id, payment_date, amount, payment_account_id, reference_type, reference_id, reference_number, branch_id, voided_at
FROM payments
WHERE reference_type ILIKE 'rental' AND reference_id = 'dd23f9b3-546c-407c-8e5c-afda407dd882'
ORDER BY payment_date;

SELECT entry_no, id, entry_date, reference_type, branch_id, is_void, created_at
FROM journal_entries
WHERE reference_id = 'dd23f9b3-546c-407c-8e5c-afda407dd882'
  AND reference_type = 'rental'
ORDER BY created_at;
