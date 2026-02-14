-- Validate staging totals before promoting to production
-- Compare output with MySQL source totals

-- Staging row counts
SELECT 'staging.contacts' AS tbl, count(*) AS cnt FROM staging.contacts
UNION ALL SELECT 'staging.products', count(*) FROM staging.products
UNION ALL SELECT 'staging.purchases', count(*) FROM staging.purchases
UNION ALL SELECT 'staging.sales', count(*) FROM staging.sales
UNION ALL SELECT 'staging.expenses', count(*) FROM staging.expenses
UNION ALL SELECT 'staging.payments', count(*) FROM staging.payments;

-- Sum checks (if tables exist)
-- SELECT sum(total) AS purchases_total FROM staging.purchases;
-- SELECT sum(total) AS sales_total FROM staging.sales;
-- SELECT sum(amount) AS payments_total FROM staging.payments;

-- Duplicate check
-- SELECT name, phone, count(*) FROM staging.contacts GROUP BY name, phone HAVING count(*) > 1;
