-- Fix initial payment backfill with proper enum casting
INSERT INTO payments (
  company_id,
  branch_id,
  payment_type,
  reference_type,
  reference_id,
  amount,
  payment_method,
  payment_date,
  payment_account_id,
  reference_number
)
SELECT 
  s.company_id,
  s.branch_id,
  'received',
  'sale',
  s.id,
  s.paid_amount,
  CASE 
    WHEN LOWER(COALESCE(s.payment_method::TEXT, 'cash')) IN ('cash') THEN 'cash'::payment_method_enum
    WHEN LOWER(COALESCE(s.payment_method::TEXT, 'cash')) IN ('bank', 'card', 'cheque') THEN 'bank'::payment_method_enum
    ELSE 'cash'::payment_method_enum
  END,
  s.invoice_date,
  COALESCE(
    (SELECT id FROM accounts 
     WHERE company_id = s.company_id 
       AND (
         (LOWER(COALESCE(s.payment_method::TEXT, 'cash')) = 'cash' AND code = '1000') OR
         (LOWER(COALESCE(s.payment_method::TEXT, 'cash')) IN ('bank', 'card') AND code = '1010')
       )
     LIMIT 1),
    (SELECT id FROM accounts WHERE company_id = s.company_id AND code = '1000' LIMIT 1)
  ),
  'PAY-INIT-' || s.invoice_no || '-' || SUBSTRING(s.id::TEXT, 1, 8)
FROM sales s
WHERE s.paid_amount > 0
  AND NOT EXISTS (
    SELECT 1 FROM payments p
    WHERE p.reference_type = 'sale'
      AND p.reference_id = s.id
      AND ABS(p.amount - s.paid_amount) < 0.01
  )
  AND s.paid_amount NOT IN (
    SELECT COALESCE(SUM(p2.amount), 0)
    FROM payments p2
    WHERE p2.reference_type = 'sale'
      AND p2.reference_id = s.id
  );
