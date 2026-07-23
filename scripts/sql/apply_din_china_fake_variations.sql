-- One-shot APPLY for DIN CHINA fake variations (run after backup + verify)
BEGIN;

UPDATE products p
SET has_variations = false,
    updated_at = now()
WHERE p.company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND p.has_variations = true
  AND (SELECT count(*) FROM product_variations pv WHERE pv.product_id = p.id) <= 1;

UPDATE sales_items si
SET variation_id = NULL
FROM sales s, products p
WHERE s.id = si.sale_id
  AND p.id = si.product_id
  AND s.company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND si.variation_id IS NOT NULL
  AND p.has_variations = false;

UPDATE purchase_items pi
SET variation_id = NULL
FROM purchases pu, products p
WHERE pu.id = pi.purchase_id
  AND p.id = pi.product_id
  AND pu.company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND pi.variation_id IS NOT NULL
  AND p.has_variations = false;

COMMIT;

SELECT 'products_has_variations_false' AS check_name,
       count(*) AS cnt
FROM products
WHERE company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND has_variations = false;

SELECT 'sales_items_variation_null_on_simple' AS check_name,
       count(*) AS cnt
FROM sales_items si
JOIN sales s ON s.id = si.sale_id
JOIN products p ON p.id = si.product_id
WHERE s.company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND p.has_variations = false
  AND si.variation_id IS NULL;

SELECT p.sku, p.name, count(pv.id) AS variation_count, p.has_variations
FROM products p
LEFT JOIN product_variations pv ON pv.product_id = p.id
WHERE p.company_id = '30bd8592-3384-4f34-899a-f3907e336485'
GROUP BY p.id, p.sku, p.name, p.has_variations
HAVING count(pv.id) > 1
ORDER BY p.sku;
