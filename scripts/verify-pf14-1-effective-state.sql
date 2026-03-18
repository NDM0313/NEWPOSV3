-- PF-14.1 Effective State & Payment Adjustment Verification
-- Run in Supabase SQL Editor. Replace company_id if needed.

-- 1) Document table is source of truth: sales.total and sales.paid_amount = effective state
SELECT id, invoice_no, total AS document_total, paid_amount AS document_paid, due_amount
FROM sales
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND status = 'final'
ORDER BY invoice_date DESC
LIMIT 20;

-- 2) Effective payment = current payment row(s). Sum of payments for a sale = document paid (trigger sync).
SELECT
  p.reference_id AS sale_id,
  COUNT(*) AS payment_count,
  SUM(p.amount) AS effective_total_paid
FROM payments p
WHERE p.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND p.reference_type = 'sale'
  AND p.payment_type = 'received'
GROUP BY p.reference_id
ORDER BY effective_total_paid DESC
LIMIT 20;

-- 3) Payment adjustment JEs exist when payment amount was edited (reference_type = 'payment_adjustment')
SELECT reference_type, COUNT(*) AS cnt
FROM journal_entries
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND reference_type IN ('sale', 'sale_adjustment', 'payment', 'payment_adjustment')
GROUP BY reference_type;

-- 4) Trial balance still zero after adjustments
SELECT (COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0))::numeric(15,2) AS tb_diff
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
WHERE je.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5';
