-- Phase 2.15 — payment-based roznamcha totals (DIN CHINA wide range)
SELECT
  COUNT(*) AS payment_rows,
  ROUND(SUM(CASE WHEN LOWER(payment_type) = 'received' THEN amount ELSE 0 END)::numeric, 2) AS cash_in,
  ROUND(SUM(CASE WHEN LOWER(payment_type) != 'received' THEN amount ELSE 0 END)::numeric, 2) AS cash_out
FROM payments p
WHERE p.company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND p.voided_at IS NULL
  AND p.payment_date >= '2000-01-01'::date
  AND p.payment_date <= '2026-06-26'::date
  AND p.payment_account_id IS NOT NULL;
