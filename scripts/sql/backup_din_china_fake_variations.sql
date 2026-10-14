CREATE TABLE IF NOT EXISTS _bak_products_dc_var_fix_20260708 AS
SELECT * FROM products WHERE company_id = '30bd8592-3384-4f34-899a-f3907e336485';

CREATE TABLE IF NOT EXISTS _bak_sales_items_dc_var_fix_20260708 AS
SELECT si.* FROM sales_items si
JOIN sales s ON s.id = si.sale_id
WHERE s.company_id = '30bd8592-3384-4f34-899a-f3907e336485';

SELECT 'backup_products' AS step, count(*) AS rows FROM _bak_products_dc_var_fix_20260708;
SELECT 'backup_sales_items' AS step, count(*) AS rows FROM _bak_sales_items_dc_var_fix_20260708;
