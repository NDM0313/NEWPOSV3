-- All liquidity movements on 2026-06-04 for company
SELECT 'rental_payments' AS src, rp.payment_date, rp.amount, a.name, rp.reference, rp.voided_at
FROM rental_payments rp
JOIN rentals r ON r.id = rp.rental_id
LEFT JOIN accounts a ON a.id = rp.payment_account_id
WHERE r.company_id = '597a5292-14c8-4cd8-96bd-c61b5a0d8c92'
  AND rp.payment_date = '2026-06-04'
  AND rp.voided_at IS NULL
UNION ALL
SELECT 'payments', p.payment_date, p.amount, a.name, p.reference_number, p.voided_at::text
FROM payments p
LEFT JOIN accounts a ON a.id = p.payment_account_id
WHERE p.company_id = '597a5292-14c8-4cd8-96bd-c61b5a0d8c92'
  AND p.payment_date = '2026-06-04'
  AND p.voided_at IS NULL;
