-- shipment_courier_overlap_audit.sql
-- Audit: courier/shipment related accounts and tables. Classify canonical vs supporting/legacy.
-- Company: eb71d817-b87e-4195-964b-7b5321b480f5

-- 1) Accounts: courier / shipment / payable (parent and child)
SELECT
  id,
  code,
  name,
  type AS account_type,
  parent_id,
  company_id,
  is_system
FROM accounts
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND (
    LOWER(name) LIKE '%courier%'
    OR LOWER(name) LIKE '%shipment%'
    OR LOWER(name) LIKE '%delivery%'
    OR code LIKE '2%'
  )
ORDER BY code, name;

-- 2) Parent-child: accounts with parent_id set (for hierarchy check)
SELECT
  c.id AS child_id,
  c.code AS child_code,
  c.name AS child_name,
  p.id AS parent_id,
  p.code AS parent_code,
  p.name AS parent_name
FROM accounts c
LEFT JOIN accounts p ON p.id = c.parent_id
WHERE c.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND (LOWER(c.name) LIKE '%courier%' OR LOWER(c.name) LIKE '%shipment%' OR c.parent_id IS NOT NULL)
ORDER BY p.code NULLS LAST, c.code;

-- 3) Tables/views that reference courier or shipment (for canonical vs legacy)
-- Run in DB: information_schema or list known tables
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (table_name LIKE '%shipment%' OR table_name LIKE '%courier%')
ORDER BY table_name;
