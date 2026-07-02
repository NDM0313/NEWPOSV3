-- Trial Balance tie-out (read-only) — Official Posted GL
--
-- Supabase SQL editor: run ONE section at a time.
-- VPS psql:
--   ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1" < scripts/sql/diag_trial_balance_tieout.sql

-- === 1. TB totals (void excluded) ===
WITH co AS (
  SELECT company_id FROM sales WHERE invoice_no IN ('HQ-SL-0003','SL-0001') LIMIT 1
),
lines AS (
  SELECT jel.debit, jel.credit
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  CROSS JOIN co
  WHERE je.company_id = co.company_id
    AND COALESCE(je.is_void, false) = false
    AND je.entry_date <= CURRENT_DATE
)
SELECT
  ROUND(COALESCE(SUM(debit), 0), 2) AS total_debit,
  ROUND(COALESCE(SUM(credit), 0), 2) AS total_credit,
  ROUND(COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0), 2) AS difference,
  CASE WHEN ABS(COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0)) < 0.01 THEN 'balanced' ELSE 'imbalanced' END AS status;

-- === 2. Balance sheet equation vs TB imbalance ===
WITH co AS (
  SELECT company_id FROM sales WHERE invoice_no IN ('HQ-SL-0003','SL-0001') LIMIT 1
),
acct AS (
  SELECT a.id, a.type, a.code
  FROM accounts a, co
  WHERE a.company_id = co.company_id
),
nets AS (
  SELECT
    ac.type,
    ROUND(COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0), 2) AS net_dr_minus_cr
  FROM acct ac
  LEFT JOIN journal_entry_lines jel ON jel.account_id = ac.id
  LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.company_id = (SELECT company_id FROM co)
    AND COALESCE(je.is_void, false) = false
    AND je.entry_date <= CURRENT_DATE
  GROUP BY ac.type
)
SELECT
  ROUND(SUM(CASE WHEN type IN ('asset', 'expense') THEN net_dr_minus_cr ELSE 0 END), 2) AS assets_plus_expense_net,
  ROUND(SUM(CASE WHEN type IN ('liability', 'equity', 'revenue') THEN net_dr_minus_cr ELSE 0 END), 2) AS liab_equity_rev_net,
  ROUND(
    SUM(CASE WHEN type IN ('asset', 'expense') THEN net_dr_minus_cr ELSE 0 END)
    + SUM(CASE WHEN type IN ('liability', 'equity', 'revenue') THEN net_dr_minus_cr ELSE 0 END),
    2
  ) AS bs_equation_residual;
