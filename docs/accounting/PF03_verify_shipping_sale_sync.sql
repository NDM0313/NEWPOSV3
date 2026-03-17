-- PF-03 Verification: Shipping–Sale Total Sync
-- Ensures for each sale with shipping: total is product-only, shipment_charges = SUM(sale_shipments.charged_to_customer), due_amount = (total + shipment_charges + studio_charges) - paid_amount.
-- Replace @company_id with literal UUID (e.g. 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee' for NEW BUSINESS).

-- Sales with at least one shipment: total should be product-only; due = (total + shipment_charges) - paid
SELECT s.id, s.invoice_no, s.total, s.shipment_charges, s.studio_charges, s.paid_amount, s.due_amount,
  (SELECT COALESCE(SUM(ss.charged_to_customer), 0) FROM sale_shipments ss WHERE ss.sale_id = s.id) AS sum_charged,
  (COALESCE(s.total, 0) + COALESCE(s.shipment_charges, 0) + COALESCE(s.studio_charges, 0) - COALESCE(s.paid_amount, 0)) AS expected_due
FROM sales s
WHERE s.company_id = '@company_id'
  AND EXISTS (SELECT 1 FROM sale_shipments ss WHERE ss.sale_id = s.id)
ORDER BY s.invoice_date DESC
LIMIT 10;
