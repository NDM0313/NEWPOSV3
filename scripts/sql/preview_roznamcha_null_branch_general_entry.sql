-- Preview: general-entry / manual liquidity payments with null branch_id (mobile legacy rows).
-- These are hidden in branch-scoped Roznamcha until branch_id is set.

SELECT p.id AS payment_id,
       p.reference_number,
       p.payment_date,
       p.amount,
       p.reference_type,
       p.payment_type,
       p.branch_id AS payment_branch_id,
       je.id AS journal_entry_id,
       je.entry_no,
       je.branch_id AS je_branch_id,
       s.id AS sale_id,
       s.branch_id AS sale_branch_id
FROM payments p
LEFT JOIN journal_entries je
  ON je.id::text = p.reference_id::text
 AND p.reference_type IN ('manual_receipt', 'manual_payment')
LEFT JOIN sales s
  ON s.id::text = p.reference_id::text
 AND p.reference_type = 'sale'
WHERE p.voided_at IS NULL
  AND p.branch_id IS NULL
  AND p.payment_date >= CURRENT_DATE - 90
  AND (
    p.reference_type IN ('manual_receipt', 'manual_payment')
    OR p.reference_type = 'sale'
  )
ORDER BY p.payment_date DESC, p.created_at DESC
LIMIT 100;
