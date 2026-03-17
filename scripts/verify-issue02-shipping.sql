-- Issue 02 verification. Company: eb71d817-b87e-4195-964b-7b5321b480f5

-- 1) One sale with shipment: total, shipment_charges, due_amount, and SUM(charged_to_customer)
SELECT s.id, s.invoice_no, s.total, s.shipment_charges, s.due_amount, s.paid_amount,
  (SELECT COALESCE(SUM(ss.charged_to_customer), 0) FROM sale_shipments ss WHERE ss.sale_id = s.id) AS sum_charged
FROM sales s
WHERE s.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND EXISTS (SELECT 1 FROM sale_shipments ss WHERE ss.sale_id = s.id)
ORDER BY s.invoice_date DESC
LIMIT 5;

-- 2) RPC returns shipment_charges (pick first customer with a sale)
SELECT * FROM get_customer_ledger_sales(
  'eb71d817-b87e-4195-964b-7b5321b480f5'::uuid,
  (SELECT customer_id FROM sales WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5' AND customer_id IS NOT NULL LIMIT 1),
  NULL, NULL
) LIMIT 5;
