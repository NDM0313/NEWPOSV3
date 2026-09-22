-- DIN CHINA: fix imported products/lines that incorrectly show variations.
-- Company: DIN CHINA (from legacy_din_china_import_final_report.md)
-- Safe: run VERIFY block first; APPLY only after review.
--
-- Logic: legacy import set has_variations=true on every product. Only TR + WOOL had
-- multiple legacy variation_ids. Products with a single empty variation row are simple SKUs.

\set ON_ERROR_STOP on

-- ========== PHASE 1: VERIFY (read-only) ==========

\echo '--- Products with has_variations=true but only one variation row ---'
SELECT p.id, p.sku, p.name, p.has_variations,
       (SELECT count(*) FROM product_variations pv WHERE pv.product_id = p.id) AS variation_count
FROM products p
WHERE p.company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND p.has_variations = true
  AND (SELECT count(*) FROM product_variations pv WHERE pv.product_id = p.id) <= 1
ORDER BY p.sku;

\echo '--- Sale lines with variation_id on simple (single-variation) products ---'
SELECT s.invoice_no, si.product_name, si.product_id, si.variation_id
FROM sales_items si
JOIN sales s ON s.id = si.sale_id
JOIN products p ON p.id = si.product_id
WHERE s.company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND si.variation_id IS NOT NULL
  AND (SELECT count(*) FROM product_variations pv WHERE pv.product_id = p.id) <= 1
ORDER BY s.invoice_no, si.product_name
LIMIT 50;

\echo '--- Multi-variation products (should stay has_variations=true) ---'
SELECT p.id, p.sku, p.name,
       (SELECT count(*) FROM product_variations pv WHERE pv.product_id = p.id) AS variation_count
FROM products p
WHERE p.company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND (SELECT count(*) FROM product_variations pv WHERE pv.product_id = p.id) > 1
ORDER BY p.sku;

-- ========== PHASE 2: APPLY (uncomment after backup) ==========
-- Backup suggestion:
--   CREATE TABLE _bak_products_dc_var_fix AS
--   SELECT * FROM products WHERE company_id = '30bd8592-3384-4f34-899a-f3907e336485';
--   CREATE TABLE _bak_sales_items_dc_var_fix AS
--   SELECT si.* FROM sales_items si
--   JOIN sales s ON s.id = si.sale_id
--   WHERE s.company_id = '30bd8592-3384-4f34-899a-f3907e336485';

/*
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
*/

\echo 'VERIFY complete. Uncomment APPLY block in this file after backup, then re-run.'
