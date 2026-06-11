-- Fix expense payments wrongly stored as 'received' (shows as Cash In in Roznamcha).
-- Preview first:
SELECT id, reference_number, payment_type, amount, reference_id
FROM payments
WHERE reference_type = 'expense'
  AND payment_type <> 'paid'
  AND voided_at IS NULL;

-- Apply (uncomment after review):
-- UPDATE payments
-- SET payment_type = 'paid'
-- WHERE reference_type = 'expense'
--   AND payment_type <> 'paid'
--   AND voided_at IS NULL;
