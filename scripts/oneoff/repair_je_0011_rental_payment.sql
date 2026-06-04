-- Repair REN-0002 10k payment (JE-0011) for Roznamcha visibility.
-- Labels/links only — no amount changes.

BEGIN;

-- Canonical ref on rental_payments row linked to JE-0011
UPDATE rental_payments rp
SET reference = r.booking_no || '-PAY'
FROM rentals r
WHERE rp.id = 'cc341b16-c127-432b-b182-ff132955bde8'
  AND rp.rental_id = r.id
  AND r.booking_no = 'REN-0002';

-- Branch on rental JE-0011
UPDATE journal_entries je
SET branch_id = r.branch_id
FROM rentals r
WHERE je.id = '2655a04a-3323-4e7a-8496-42b0fa4d88e7'
  AND je.reference_id = r.id
  AND r.booking_no = 'REN-0002'
  AND je.branch_id IS NULL;

-- Void duplicate orphan payments row (RCV-0007 on generic Cash 1000 — canonical path is rental_payments + JE-0011 on CASH G140)
UPDATE payments
SET voided_at = NOW()
WHERE id = 'b8f4f9bc-5ed5-4827-9244-9443c47351c1'
  AND voided_at IS NULL;

-- Void JE chain for orphan RCV-0007 (reference_type payment, not rental)
UPDATE journal_entries
SET is_void = true,
    void_reason = 'Duplicate orphan rental receipt — canonical REN-0002-PAY + JE-0011',
    voided_at = NOW()
WHERE id = '41512787-bd81-43a9-aa58-500191b11cbf'
  AND COALESCE(is_void, false) = false;

COMMIT;

-- Verify
SELECT rp.reference, rp.payment_account_id, rp.journal_entry_id, je.entry_no, je.branch_id, je.is_void
FROM rental_payments rp
JOIN journal_entries je ON je.id = rp.journal_entry_id
WHERE rp.id = 'cc341b16-c127-432b-b182-ff132955bde8';

SELECT reference_number, voided_at, payment_account_id
FROM payments WHERE id = 'b8f4f9bc-5ed5-4827-9244-9443c47351c1';
