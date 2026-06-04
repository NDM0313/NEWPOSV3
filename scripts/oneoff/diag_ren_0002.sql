SELECT r.booking_no, r.branch_id AS rental_branch,
       rp.id AS rp_id, rp.amount, rp.payment_date, rp.method,
       rp.payment_account_id, rp.journal_entry_id, rp.reference, rp.voided_at,
       je.entry_no, je.entry_date, je.branch_id AS je_branch,
       p.id AS payment_id, p.branch_id AS pay_branch, p.reference_number
FROM rentals r
JOIN rental_payments rp ON rp.rental_id = r.id
LEFT JOIN journal_entries je ON je.id = rp.journal_entry_id
LEFT JOIN payments p ON p.reference_type = 'rental' AND p.reference_id = r.id
  AND p.payment_date = rp.payment_date AND abs(p.amount - rp.amount) < 0.02
WHERE r.booking_no ILIKE 'REN-0002';
