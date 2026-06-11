-- Find branches for company with JE-0017 / JV-000202
SELECT b.id, b.name, b.code, b.company_id
FROM branches b
WHERE b.company_id = '597a5292-14c8-4cd8-96bd-c61b5a0d8c92'
ORDER BY b.name;

-- Recent sales/payments with branch for same company (infer default branch)
SELECT branch_id, count(*) AS cnt
FROM payments
WHERE company_id = '597a5292-14c8-4cd8-96bd-c61b5a0d8c92'
  AND branch_id IS NOT NULL
  AND payment_date >= CURRENT_DATE - 30
GROUP BY branch_id
ORDER BY cnt DESC
LIMIT 5;
