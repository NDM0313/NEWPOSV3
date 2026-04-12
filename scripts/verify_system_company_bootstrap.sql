-- =============================================================================
-- SCRIPT 1: verify_system_company_bootstrap.sql
-- Purpose:  Verify that every company is fully bootstrapped — default branch,
--           chart of accounts, walk-in customer, user branch access,
--           document sequences, and account parent integrity.
-- Tables:   companies, branches, accounts, contacts, users, user_branches,
--           erp_document_sequences
-- Date:     2026-04-12
-- Safe:     SELECT only — no modifications made
-- =============================================================================

-- =============================================================================
-- CHECK 1: Companies with no default branch
-- Expected: 0 rows — every company must have exactly one branch where
--           is_default = TRUE. A missing default branch breaks the POS
--           and any feature that auto-selects a branch.
-- =============================================================================
SELECT
    'CHECK 1: Companies with no default branch' AS check_name,
    c.id                                        AS company_id,
    c.name                                      AS company_name,
    COUNT(b.id)                                 AS total_branches,
    SUM(CASE WHEN b.is_default THEN 1 ELSE 0 END) AS default_branch_count
FROM companies c
LEFT JOIN branches b ON b.company_id = c.id
GROUP BY c.id, c.name
HAVING SUM(CASE WHEN b.is_default THEN 1 ELSE 0 END) = 0
    OR SUM(CASE WHEN b.is_default THEN 1 ELSE 0 END) IS NULL
ORDER BY c.name;

-- =============================================================================
-- CHECK 2: Companies with no accounts (COA not seeded)
-- Expected: 0 rows — every company must have its chart of accounts seeded
--           before any transactions can be recorded.
-- =============================================================================
SELECT
    'CHECK 2: Companies with no chart of accounts' AS check_name,
    c.id                                           AS company_id,
    c.name                                         AS company_name,
    c.created_at
FROM companies c
LEFT JOIN accounts a ON a.company_id = c.id
WHERE a.id IS NULL
ORDER BY c.created_at DESC;

-- =============================================================================
-- CHECK 3: Missing required account codes per company
-- Expected: 0 rows — every company must have all seven core accounts.
--           Missing any of these will cause journal entry posting failures.
-- =============================================================================
WITH required_codes AS (
    SELECT unnest(ARRAY['1000','1010','1100','1200','2000','4100','5000']) AS code
),
company_codes AS (
    SELECT
        c.id   AS company_id,
        c.name AS company_name,
        a.code
    FROM companies c
    CROSS JOIN required_codes rc
    LEFT JOIN accounts a
        ON a.company_id = c.id AND a.code = rc.code
)
SELECT
    'CHECK 3: Missing required account codes' AS check_name,
    company_id,
    company_name,
    array_agg(code ORDER BY code) AS missing_codes
FROM company_codes
WHERE code IS NULL
GROUP BY company_id, company_name
ORDER BY company_name;

-- =============================================================================
-- CHECK 4: Companies with no walk-in customer record
-- Expected: 0 rows — a walk-in customer contact (or equivalent) must exist
--           so that cash sales can be recorded without a named customer.
--           Checks for 'Walk-in Customer', 'Walkin', 'Walk-In' (case-insensitive).
-- =============================================================================
SELECT
    'CHECK 4: Companies with no walk-in customer' AS check_name,
    c.id                                          AS company_id,
    c.name                                        AS company_name
FROM companies c
WHERE NOT EXISTS (
    SELECT 1
    FROM contacts ct
    WHERE ct.company_id = c.id
      AND ct.contact_type IN ('customer', 'both')
      AND (
          ct.name ILIKE '%walk%in%'
          OR ct.name ILIKE '%walkin%'
          OR ct.name ILIKE '%walk-in%'
          OR ct.name ILIKE '%cash customer%'
      )
)
ORDER BY c.name;

-- =============================================================================
-- CHECK 5: Users with no user_branches row (no branch access assigned)
-- Expected: 0 rows — every active user must be assigned to at least one branch,
--           otherwise they cannot perform any branch-scoped operations.
-- =============================================================================
SELECT
    'CHECK 5: Active users with no branch access' AS check_name,
    u.id                                          AS user_id,
    u.email,
    u.role,
    c.name                                        AS company_name,
    u.company_id
FROM users u
JOIN companies c ON c.id = u.company_id
WHERE u.is_active = TRUE
  AND NOT EXISTS (
      SELECT 1
      FROM user_branches ub
      WHERE ub.user_id = u.id
        AND ub.company_id = u.company_id
  )
ORDER BY c.name, u.email;

-- =============================================================================
-- CHECK 6: Document sequences missing for key doc types (SL, PUR, PAY)
-- Expected: 0 rows — each company must have erp_document_sequences entries
--           for at least SL (Sale), PUR (Purchase), and PAY (Payment).
--           Missing sequences cause invoice numbering failures.
-- =============================================================================
WITH required_types AS (
    SELECT unnest(ARRAY['SL','PUR','PAY']) AS doc_type
),
company_sequences AS (
    SELECT
        c.id   AS company_id,
        c.name AS company_name,
        rt.doc_type,
        eds.id AS seq_id
    FROM companies c
    CROSS JOIN required_types rt
    LEFT JOIN erp_document_sequences eds
        ON eds.company_id = c.id AND eds.doc_type = rt.doc_type
)
SELECT
    'CHECK 6: Missing document sequences' AS check_name,
    company_id,
    company_name,
    array_agg(doc_type ORDER BY doc_type) AS missing_doc_types
FROM company_sequences
WHERE seq_id IS NULL
GROUP BY company_id, company_name
ORDER BY company_name;

-- =============================================================================
-- CHECK 7: Accounts with broken parent_id links
-- Expected: 0 rows — every account whose parent_id is set must reference an
--           account that (a) exists and (b) belongs to the same company.
--           Broken links corrupt COA hierarchy display and rollup calculations.
-- =============================================================================
SELECT
    'CHECK 7: Accounts with broken parent_id' AS check_name,
    a.id                                      AS account_id,
    a.company_id,
    a.code                                    AS account_code,
    a.name                                    AS account_name,
    a.parent_id                               AS broken_parent_id,
    c.name                                    AS company_name
FROM accounts a
JOIN companies c ON c.id = a.company_id
WHERE a.parent_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM accounts p
      WHERE p.id = a.parent_id
        AND p.company_id = a.company_id
  )
ORDER BY a.company_id, a.code;
