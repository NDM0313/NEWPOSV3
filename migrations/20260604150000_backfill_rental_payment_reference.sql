-- Backfill rental_payments.reference to canonical REN-*-PAY voucher refs (labels only; no money/stock impact).
UPDATE rental_payments rp
SET reference = r.booking_no || '-PAY'
FROM rentals r
WHERE rp.rental_id = r.id
  AND r.booking_no ~ '^REN-'
  AND (
    rp.reference IS NULL
    OR btrim(rp.reference) = ''
    OR rp.reference ~* '^advance'
  );
