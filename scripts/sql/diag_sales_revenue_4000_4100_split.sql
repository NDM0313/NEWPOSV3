-- =====================================================================
-- DIAGNOSIS: Sales Revenue 4000 vs 4100 split — read-only
-- Purpose  : Explain dual "Sales Revenue" lines in P&L / TB
-- Safe     : SELECT only. No INSERT/UPDATE/DELETE.
-- Usage    :
--   psql -v company_id="'<uuid>'" -v period_start="'2026-07-01'" -v period_end="'2026-07-10'" -f scripts/sql/diag_sales_revenue_4000_4100_split.sql
--   Or on VPS:
--   Get-Content scripts/sql/diag_sales_revenue_4000_4100_split.sql -Raw | ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres -v company_id='2ab65903-62a3-4bcf-bced-076b681e9b74' -v period_start='2026-07-01' -v period_end='2026-07-10'"
-- Default company: DIN COUTURE
-- =====================================================================

\set ON_ERROR_STOP on

-- Override at invoke time if needed
\if :{?company_id}
\else
  \set company_id '2ab65903-62a3-4bcf-bced-076b681e9b74'
\endif

\if :{?period_start}
\else
  \set period_start '2026-07-01'
\endif

\if :{?period_end}
\else
  \set period_end '2026-07-10'
\endif

\if :{?recent_sales_limit}
\else
  \set recent_sales_limit 20
\endif

SELECT '=== 0. Company ===' AS section;
SELECT id, name, created_at
FROM companies
WHERE id = :'company_id'::uuid;

-- ─── 1. COA state ───────────────────────────────────────────────────────────
SELECT '=== 1. Revenue-related COA accounts ===' AS section;
SELECT
  a.id,
  a.code,
  a.name,
  a.type,
  a.is_active,
  a.is_group,
  a.parent_id,
  p.code AS parent_code,
  p.name AS parent_name,
  ROUND(COALESCE(a.balance, 0)::numeric, 2) AS account_balance_field
FROM accounts a
LEFT JOIN accounts p ON p.id = a.parent_id
WHERE a.company_id = :'company_id'::uuid
  AND (
    a.code IN ('4000', '4100', '4010', '4110', '4120', '4050')
    OR a.name ILIKE '%sales revenue%'
    OR a.name ILIKE '%shipping income%'
    OR a.name ILIKE '%studio%revenue%'
  )
ORDER BY a.code;

-- ─── 2. TB by revenue code (period + all-time) ────────────────────────────
SELECT '=== 2a. Revenue TB — period ' || :'period_start' || ' to ' || :'period_end' || ' ===' AS section;
SELECT
  a.code,
  a.name,
  COUNT(jel.id) AS line_count,
  ROUND(COALESCE(SUM(jel.credit), 0)::numeric, 2) AS total_credit,
  ROUND(COALESCE(SUM(jel.debit), 0)::numeric, 2) AS total_debit,
  ROUND(COALESCE(SUM(jel.credit) - SUM(jel.debit), 0)::numeric, 2) AS net_revenue
FROM accounts a
LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id
  AND COALESCE(je.is_void, false) = false
  AND je.entry_date >= :'period_start'::date
  AND je.entry_date <= :'period_end'::date
WHERE a.company_id = :'company_id'::uuid
  AND a.code IN ('4000', '4100', '4010', '4110', '4120')
GROUP BY a.id, a.code, a.name
ORDER BY a.code;

SELECT '=== 2b. Revenue TB — all-time (non-void) ===' AS section;
SELECT
  a.code,
  a.name,
  COUNT(jel.id) AS line_count,
  ROUND(COALESCE(SUM(jel.credit), 0)::numeric, 2) AS total_credit,
  ROUND(COALESCE(SUM(jel.debit), 0)::numeric, 2) AS total_debit,
  ROUND(COALESCE(SUM(jel.credit) - SUM(jel.debit), 0)::numeric, 2) AS net_revenue
FROM accounts a
JOIN journal_entry_lines jel ON jel.account_id = a.id
JOIN journal_entries je ON je.id = jel.journal_entry_id
WHERE a.company_id = :'company_id'::uuid
  AND a.code IN ('4000', '4100', '4010', '4110', '4120')
  AND COALESCE(je.is_void, false) = false
GROUP BY a.id, a.code, a.name
ORDER BY a.code;

-- ─── 3. Sale document JEs by revenue code ─────────────────────────────────
SELECT '=== 3. Canonical sale document JEs — revenue credits by code ===' AS section;
SELECT
  a.code AS revenue_code,
  a.name AS revenue_name,
  COUNT(DISTINCT je.id) AS sale_je_count,
  COUNT(DISTINCT je.reference_id) AS distinct_sales,
  ROUND(COALESCE(SUM(jel.credit), 0)::numeric, 2) AS total_revenue_credit,
  ROUND(COALESCE(SUM(jel.debit), 0)::numeric, 2) AS total_revenue_debit
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN accounts a ON a.id = jel.account_id
WHERE je.company_id = :'company_id'::uuid
  AND je.reference_type = 'sale'
  AND je.payment_id IS NULL
  AND COALESCE(je.is_void, false) = false
  AND a.code IN ('4000', '4100', '4010', '4110', '4120')
GROUP BY a.code, a.name
ORDER BY a.code;

-- ─── 4. Sale return settlement — revenue debits by code ───────────────────
SELECT '=== 4. Sale return settlement — revenue debits by code ===' AS section;
SELECT
  a.code AS revenue_code,
  COUNT(DISTINCT je.id) AS return_je_count,
  ROUND(COALESCE(SUM(jel.debit), 0)::numeric, 2) AS total_revenue_debit
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN accounts a ON a.id = jel.account_id
WHERE je.company_id = :'company_id'::uuid
  AND je.reference_type = 'sale_return'
  AND COALESCE(je.is_void, false) = false
  AND a.code IN ('4000', '4100', '4010')
  AND jel.debit > 0
GROUP BY a.code
ORDER BY a.code;

-- ─── 5. Recent final sales — revenue account attribution ──────────────────
SELECT '=== 5. Recent final sales — which revenue account was credited ===' AS section;
WITH sale_doc_je AS (
  SELECT DISTINCT ON (je.reference_id)
    je.reference_id AS sale_id,
    je.id AS je_id,
    je.entry_date,
    je.document_no,
    je.created_at AS je_created_at
  FROM journal_entries je
  WHERE je.company_id = :'company_id'::uuid
    AND je.reference_type = 'sale'
    AND je.payment_id IS NULL
    AND COALESCE(je.is_void, false) = false
  ORDER BY je.reference_id, je.created_at ASC
),
revenue_lines AS (
  SELECT
    sdj.sale_id,
    sdj.je_id,
    sdj.entry_date,
    sdj.document_no,
    a.code AS revenue_code,
    a.name AS revenue_name,
    ROUND(jel.credit::numeric, 2) AS revenue_credit,
    ROUND(jel.debit::numeric, 2) AS revenue_debit
  FROM sale_doc_je sdj
  JOIN journal_entry_lines jel ON jel.journal_entry_id = sdj.je_id
  JOIN accounts a ON a.id = jel.account_id
  WHERE a.code IN ('4000', '4100', '4010', '4110', '4120')
    AND (jel.credit > 0 OR jel.debit > 0)
)
SELECT
  s.id AS sale_id,
  s.invoice_no,
  s.invoice_date,
  s.status,
  ROUND(s.total::numeric, 2) AS sale_total,
  s.created_at,
  s.created_by,
  b.name AS branch_name,
  rl.revenue_code,
  rl.revenue_name,
  rl.revenue_credit,
  rl.revenue_debit,
  rl.document_no AS je_document_no
FROM sales s
LEFT JOIN branches b ON b.id = s.branch_id
LEFT JOIN revenue_lines rl ON rl.sale_id = s.id
WHERE s.company_id = :'company_id'::uuid
  AND s.status = 'final'
ORDER BY s.created_at DESC
LIMIT :recent_sales_limit;

-- ─── 6. Period sales — 4000 vs 4100 split ─────────────────────────────────
SELECT '=== 6. Sales in period — revenue code attribution summary ===' AS section;
WITH period_sales AS (
  SELECT s.id
  FROM sales s
  WHERE s.company_id = :'company_id'::uuid
    AND s.status = 'final'
    AND s.invoice_date >= :'period_start'::date
    AND s.invoice_date <= :'period_end'::date
),
sale_revenue AS (
  SELECT
    je.reference_id AS sale_id,
    STRING_AGG(DISTINCT a.code, ', ' ORDER BY a.code) AS revenue_codes,
    ROUND(SUM(jel.credit)::numeric, 2) AS total_revenue_credit
  FROM journal_entries je
  JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
  JOIN accounts a ON a.id = jel.account_id
  WHERE je.company_id = :'company_id'::uuid
    AND je.reference_type = 'sale'
    AND je.payment_id IS NULL
    AND COALESCE(je.is_void, false) = false
    AND je.reference_id IN (SELECT id FROM period_sales)
    AND a.code IN ('4000', '4100', '4010', '4110', '4120')
    AND jel.credit > 0
  GROUP BY je.reference_id
)
SELECT
  COALESCE(sr.revenue_codes, '(no revenue line)') AS revenue_codes,
  COUNT(*) AS sale_count,
  ROUND(SUM(s.total)::numeric, 2) AS sum_sale_totals,
  ROUND(SUM(sr.total_revenue_credit)::numeric, 2) AS sum_revenue_credits
FROM period_sales ps
JOIN sales s ON s.id = ps.id
LEFT JOIN sale_revenue sr ON sr.sale_id = ps.id
GROUP BY COALESCE(sr.revenue_codes, '(no revenue line)')
ORDER BY sale_count DESC;

-- ─── 7. Sales with BOTH 4000 and 4100 on same document JE (unusual) ───────
SELECT '=== 7. Sales crediting BOTH 4000 and 4100 on document JE ===' AS section;
WITH per_sale_codes AS (
  SELECT
    je.reference_id AS sale_id,
    COUNT(DISTINCT a.code) FILTER (WHERE a.code IN ('4000', '4100') AND jel.credit > 0) AS rev_code_count,
    ARRAY_AGG(DISTINCT a.code ORDER BY a.code) FILTER (WHERE a.code IN ('4000', '4100') AND jel.credit > 0) AS codes
  FROM journal_entries je
  JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
  JOIN accounts a ON a.id = jel.account_id
  WHERE je.company_id = :'company_id'::uuid
    AND je.reference_type = 'sale'
    AND je.payment_id IS NULL
    AND COALESCE(je.is_void, false) = false
  GROUP BY je.reference_id
)
SELECT
  s.invoice_no,
  s.invoice_date,
  ROUND(s.total::numeric, 2) AS sale_total,
  psc.codes
FROM per_sale_codes psc
JOIN sales s ON s.id = psc.sale_id
WHERE psc.rev_code_count > 1
ORDER BY s.invoice_date DESC
LIMIT 25;

-- ─── 8. Count sales by primary merchandise revenue code (4000 vs 4100) ───
SELECT '=== 8. All-time sale count by merchandise revenue code (4000/4100 credit) ===' AS section;
WITH merch_credit AS (
  SELECT
    je.reference_id AS sale_id,
    a.code,
    SUM(jel.credit) AS credit
  FROM journal_entries je
  JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
  JOIN accounts a ON a.id = jel.account_id
  WHERE je.company_id = :'company_id'::uuid
    AND je.reference_type = 'sale'
    AND je.payment_id IS NULL
    AND COALESCE(je.is_void, false) = false
    AND a.code IN ('4000', '4100')
    AND jel.credit > 0
  GROUP BY je.reference_id, a.code
)
SELECT
  code AS merchandise_revenue_code,
  COUNT(DISTINCT sale_id) AS sale_count,
  ROUND(SUM(credit)::numeric, 2) AS total_credit
FROM merch_credit
GROUP BY code
ORDER BY code;

-- ─── 9. Sales with no 4000/4100 revenue line on document JE ───────────────
SELECT '=== 9. Final sales missing 4000/4100 revenue credit (sample) ===' AS section;
WITH has_merch_rev AS (
  SELECT DISTINCT je.reference_id AS sale_id
  FROM journal_entries je
  JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
  JOIN accounts a ON a.id = jel.account_id
  WHERE je.company_id = :'company_id'::uuid
    AND je.reference_type = 'sale'
    AND je.payment_id IS NULL
    AND COALESCE(je.is_void, false) = false
    AND a.code IN ('4000', '4100')
    AND jel.credit > 0
)
SELECT
  s.id,
  s.invoice_no,
  s.invoice_date,
  ROUND(s.total::numeric, 2) AS total,
  s.created_at
FROM sales s
WHERE s.company_id = :'company_id'::uuid
  AND s.status = 'final'
  AND s.id NOT IN (SELECT sale_id FROM has_merch_rev)
ORDER BY s.created_at DESC
LIMIT 15;

SELECT '=== DONE — read-only diagnosis complete ===' AS section;
