-- chart_of_accounts_final_health_check.sql
-- Health check: duplicate codes, duplicate names, orphans, payment accounts, courier structure.
-- Company: eb71d817-b87e-4195-964b-7b5321b480f5

-- 1) Duplicate codes (same company)
SELECT code, company_id, COUNT(*) AS cnt, array_agg(name) AS names
FROM accounts
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
GROUP BY code, company_id
HAVING COUNT(*) > 1;

-- 2) Duplicate normalized names (lower trim)
SELECT LOWER(TRIM(name)) AS norm_name, company_id, COUNT(*) AS cnt, array_agg(id) AS ids
FROM accounts
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
GROUP BY LOWER(TRIM(name)), company_id
HAVING COUNT(*) > 1;

-- 3) Orphan child accounts (parent_id points to missing or wrong company)
SELECT c.id, c.code, c.name, c.parent_id
FROM accounts c
LEFT JOIN accounts p ON p.id = c.parent_id AND p.company_id = c.company_id
WHERE c.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND c.parent_id IS NOT NULL
  AND p.id IS NULL;

-- 4) Payment-related accounts (Cash/Bank/Wallet)
SELECT id, code, name, type
FROM accounts
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND (code IN ('1000','1010','1020') OR LOWER(name) LIKE '%cash%' OR LOWER(name) LIKE '%bank%' OR LOWER(name) LIKE '%wallet%')
ORDER BY code;

-- 5) Child accounts (parent_id set; for hierarchy / sub-account visibility)
SELECT id, code, name, parent_id
FROM accounts
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND parent_id IS NOT NULL
ORDER BY parent_id, code;

-- 6) Courier/shipment child accounts (for UI: hide or group under parent)
SELECT id, code, name, parent_id
FROM accounts
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND (LOWER(name) LIKE '%courier%' OR LOWER(name) LIKE '%shipment%')
ORDER BY parent_id NULLS LAST, code;
