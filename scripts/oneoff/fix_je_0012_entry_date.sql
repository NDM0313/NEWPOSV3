-- One-off: HQ-RCV-0006 / JE-0012 (Inayat rental receipt) transaction date → 2026-05-25
-- Does not change amounts, GL lines, void state, or numbering.

BEGIN;

UPDATE journal_entries
SET entry_date = '2026-05-25',
    updated_at = NOW()
WHERE id = 'b7c07c56-fb71-404c-97f4-b9756b05c2b5'
  AND entry_no = 'JE-0012'
  AND (is_void IS NULL OR is_void = false);

UPDATE rental_payments
SET payment_date = '2026-05-25'
WHERE id = '4b01eaa7-86b6-4a61-8f9e-48e5f5662129'
  AND reference = 'HQ-RCV-0006'
  AND voided_at IS NULL;

COMMIT;

SELECT je.entry_no, je.entry_date, je.description,
       rp.reference AS rp_ref, rp.payment_date AS rp_date
FROM journal_entries je
LEFT JOIN rental_payments rp ON rp.journal_entry_id = je.id
WHERE je.id = 'b7c07c56-fb71-404c-97f4-b9756b05c2b5';
