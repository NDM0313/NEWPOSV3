-- Reconcile REN-0002 paid/due from active (non-voided) rental_payments only.
-- Safe labels/money sync — voided REN-0002-PAY must not count toward paid_amount.
-- Run after diag_sale_payment_ren_0002_crosslink.sql confirms voided duplicate row.

BEGIN;

WITH active_payments AS (
  SELECT
    rp.rental_id,
    COALESCE(SUM(rp.amount), 0) AS paid_sum
  FROM rental_payments rp
  JOIN rentals r ON r.id = rp.rental_id
  WHERE r.booking_no = 'REN-0002'
    AND rp.voided_at IS NULL
  GROUP BY rp.rental_id
)
UPDATE rentals r
SET
  paid_amount = ap.paid_sum,
  due_amount = GREATEST(0, COALESCE(r.total_amount, 0) - ap.paid_sum)
FROM active_payments ap
WHERE r.id = ap.rental_id
  AND r.booking_no = 'REN-0002';

COMMIT;

-- Verify
SELECT
  r.booking_no,
  r.total_amount,
  r.paid_amount,
  r.due_amount,
  (
    SELECT COALESCE(SUM(rp.amount), 0)
    FROM rental_payments rp
    WHERE rp.rental_id = r.id AND rp.voided_at IS NULL
  ) AS active_payments_sum
FROM rentals r
WHERE r.booking_no = 'REN-0002';

SELECT rp.id, rp.reference, rp.amount, rp.payment_date, rp.voided_at
FROM rental_payments rp
JOIN rentals r ON r.id = rp.rental_id
WHERE r.booking_no = 'REN-0002'
ORDER BY rp.payment_date DESC;
