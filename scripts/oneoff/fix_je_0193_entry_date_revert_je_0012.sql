-- Revert mistaken JE-0012 / HQ-RCV-0006 date change; set JE-0193 (830000 opening balance) → 2026-05-25

BEGIN;

-- Revert JE-0012 / HQ-RCV-0006 (Inayat) back to original date
UPDATE journal_entries
SET entry_date = '2026-06-04',
    updated_at = NOW()
WHERE id = 'b7c07c56-fb71-404c-97f4-b9756b05c2b5'
  AND entry_no = 'JE-0012'
  AND (is_void IS NULL OR is_void = false);

UPDATE rental_payments
SET payment_date = '2026-06-04'
WHERE id = '4b01eaa7-86b6-4a61-8f9e-48e5f5662129'
  AND reference = 'HQ-RCV-0006'
  AND voided_at IS NULL;

-- Correct target: JE-0193 opening balance Cash in NDM — Rs 830,000
UPDATE journal_entries
SET entry_date = '2026-05-25',
    updated_at = NOW()
WHERE id = '0ef00be3-ca98-4a19-bae9-8849605d0f84'
  AND entry_no = 'JE-0193'
  AND (is_void IS NULL OR is_void = false);

COMMIT;

SELECT entry_no, entry_date, description,
       (SELECT SUM(debit) FROM journal_entry_lines jel WHERE jel.journal_entry_id = je.id) AS total_debit
FROM journal_entries je
WHERE je.id IN ('b7c07c56-fb71-404c-97f4-b9756b05c2b5', '0ef00be3-ca98-4a19-bae9-8849605d0f84')
ORDER BY entry_no;

SELECT reference, payment_date FROM rental_payments WHERE reference = 'HQ-RCV-0006';
