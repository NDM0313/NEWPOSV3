\echo 'erp_document_sequences snapshot:'
SELECT document_type, year, last_number
FROM erp_document_sequences
ORDER BY document_type, year;

\echo ''
\echo 'Actual max reference_number per source table:'
SELECT 'PAYMENT' AS document_type, MAX(reference_number) AS current_max
FROM payments
WHERE reference_number ~ '^PAY-';

SELECT 'SALE' AS document_type, MAX(reference_number) AS current_max
FROM sales
WHERE reference_number ~ '^(INV|STD)-';

SELECT 'PURCHASE' AS document_type, MAX(reference_number) AS current_max
FROM purchases
WHERE reference_number ~ '^(PO|PUR)-';

SELECT 'EXPENSE' AS document_type, MAX(reference_number) AS current_max
FROM expenses
WHERE reference_number ~ '^EXP-';
