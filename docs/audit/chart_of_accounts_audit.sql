-- ============================================================================
-- CHART OF ACCOUNTS INTEGRITY AUDIT (READ-ONLY)
-- Company: eb71d817-b87e-4195-964b-7b5321b480f5 (parameterize if needed)
-- Run in Supabase SQL Editor. No DELETE/DROP/TRUNCATE.
-- ============================================================================

-- 1) Duplicate account codes (same company): must be 0 if UNIQUE(company_id, code) exists
SELECT
  company_id,
  code,
  COUNT(*) AS cnt,
  array_agg(name) AS names,
  array_agg(id) AS ids
FROM accounts
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
GROUP BY company_id, code
HAVING COUNT(*) > 1;

-- 2) Duplicate account names (same company, different ids): informational
SELECT
  company_id,
  name,
  COUNT(*) AS cnt,
  array_agg(code) AS codes,
  array_agg(id) AS ids
FROM accounts
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND is_active = true
GROUP BY company_id, name
HAVING COUNT(*) > 1;

-- 3) Parent/child: parent_id must reference existing account in same company
SELECT
  c.id AS child_id,
  c.code AS child_code,
  c.name AS child_name,
  c.parent_id,
  p.id AS parent_exists,
  p.company_id AS parent_company
FROM accounts c
LEFT JOIN accounts p ON p.id = c.parent_id
WHERE c.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND c.parent_id IS NOT NULL
  AND (p.id IS NULL OR p.company_id <> c.company_id);

-- 4) Required default account codes (commonly expected: 1000 Cash, 1010 Bank, 2000 AR, 2010 Worker Payable, 2030 Courier, 5000 Studio Cost, 4100 Revenue, 5100 Expense)
SELECT
  code,
  name,
  type,
  is_active
FROM accounts
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND code IN ('1000','1010','2000','2010','2030','5000','4100','5100')
ORDER BY code;

-- 5) Orphan accounts: not referenced in journal_entry_lines (informational, may be new or control-only)
SELECT
  a.id,
  a.code,
  a.name,
  a.type
FROM accounts a
WHERE a.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND a.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    WHERE je.company_id = a.company_id AND jel.account_id = a.id
  )
ORDER BY a.code;

-- 6) Courier/Worker/Studio overlap: accounts with contact_id (courier sub-ledgers) vs code 2010 (Worker Payable)
SELECT
  id,
  code,
  name,
  type,
  contact_id,
  parent_id
FROM accounts
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND (code LIKE '203%' OR code = '2010' OR contact_id IS NOT NULL)
ORDER BY code;

-- 7) Chart from legacy schema (if chart_accounts exists): do not use for live; compare with accounts
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chart_accounts') THEN
    RAISE NOTICE 'chart_accounts exists - legacy; live Chart of Accounts is accounts.';
  END IF;
END $$;
