SELECT p.sku, p.name, ROUND(COALESCE(SUM(sm.quantity), 0)::numeric, 2) AS stock
FROM stock_movements sm
JOIN products p ON p.id = sm.product_id
WHERE sm.company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND p.sku IN ('0008', '0014', '0017-1', '0018')
GROUP BY p.sku, p.name, sm.product_id, sm.variation_id
ORDER BY p.sku;
