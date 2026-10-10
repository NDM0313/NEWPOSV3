SELECT id, invoice_no, customer_id, customer_name, total, status
FROM sales
WHERE company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND invoice_no ILIKE '%0018%'
ORDER BY created_at DESC
LIMIT 5;

SELECT s.invoice_no, si.product_name, si.quantity, si.variation_id, p.has_variations, p.sku
FROM sales_items si
JOIN sales s ON s.id = si.sale_id
JOIN products p ON p.id = si.product_id
WHERE s.company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND s.invoice_no ILIKE '%0018%';
