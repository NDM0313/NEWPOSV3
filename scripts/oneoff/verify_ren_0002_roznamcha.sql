-- Simulate Roznamcha visibility for REN-0002 10k payment (2026-06-04)
SELECT
  rp.id,
  rp.reference,
  rp.payment_date,
  rp.amount,
  rp.payment_account_id,
  a.name AS account_name,
  a.type AS account_type,
  rp.voided_at,
  r.booking_no,
  r.branch_id AS rental_branch
FROM rental_payments rp
JOIN rentals r ON r.id = rp.rental_id
LEFT JOIN accounts a ON a.id = rp.payment_account_id
WHERE r.booking_no = 'REN-0002'
  AND rp.payment_date = '2026-06-04'
  AND rp.voided_at IS NULL;

SELECT id, reference_number, voided_at
FROM payments
WHERE reference_id = 'dd23f9b3-546c-407c-8e5c-afda407dd882'
  AND payment_date = '2026-06-04';
