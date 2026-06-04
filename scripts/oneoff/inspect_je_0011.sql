-- Inspect JE-0011 + rental payment links (read-only diagnostic)
SELECT
  je.entry_no,
  je.entry_date,
  je.reference_type,
  je.reference_id,
  je.payment_id,
  je.branch_id,
  je.is_void,
  je.id AS je_id,
  je.company_id,
  je.description,
  rp.id AS rp_id,
  rp.amount AS rp_amount,
  rp.payment_date AS rp_payment_date,
  rp.payment_account_id,
  rp.journal_entry_id,
  rp.reference AS rp_ref,
  rp.voided_at AS rp_voided_at,
  p.reference_number,
  p.payment_account_id AS pay_acct,
  p.reference_type AS pay_ref_type,
  jel.account_id AS cash_account,
  a.name AS cash_account_name,
  a.type AS cash_account_type,
  r.booking_no,
  r.branch_id AS rental_branch_id
FROM journal_entries je
LEFT JOIN rental_payments rp
  ON rp.journal_entry_id = je.id
  OR (rp.rental_id = je.reference_id AND rp.payment_date = je.entry_date)
LEFT JOIN payments p ON p.id = je.payment_id
LEFT JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id AND COALESCE(jel.debit, 0) > 0
LEFT JOIN accounts a ON a.id = jel.account_id
LEFT JOIN rentals r ON r.id = je.reference_id
WHERE je.entry_no = 'JE-0011';

-- All rental_payments for same rental as JE-0011
SELECT rp.id, rp.amount, rp.payment_date, rp.payment_account_id, rp.journal_entry_id, rp.reference, rp.voided_at
FROM rental_payments rp
WHERE rp.rental_id = (
  SELECT reference_id FROM journal_entries WHERE entry_no = 'JE-0011' LIMIT 1
)
ORDER BY rp.payment_date DESC, rp.created_at DESC;
