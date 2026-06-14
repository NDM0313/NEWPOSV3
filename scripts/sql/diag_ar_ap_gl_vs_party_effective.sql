-- AR/AP control (1100/2000) vs party subledgers (read-only)
--
-- Supabase SQL editor: run ONE section at a time.
-- VPS psql:
--   ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1" < scripts/sql/diag_ar_ap_gl_vs_party_effective.sql

-- === 1. Control 1100 net ===
WITH co AS (
  SELECT company_id FROM sales WHERE invoice_no IN ('HQ-SL-0003','SL-0001') LIMIT 1
),
ctrl AS (
  SELECT a.id FROM accounts a, co
  WHERE a.company_id = co.company_id AND a.code = '1100'
  LIMIT 1
)
SELECT
  '1100 control' AS slice,
  ROUND(COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0), 2) AS net_dr_minus_cr
FROM ctrl c
LEFT JOIN journal_entry_lines jel ON jel.account_id = c.id
LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.company_id = (SELECT company_id FROM co)
  AND COALESCE(je.is_void, false) = false;

-- === 2. Sum AR-CUS* subledgers (raw official GL) ===
WITH co AS (
  SELECT company_id FROM sales WHERE invoice_no IN ('HQ-SL-0003','SL-0001') LIMIT 1
),
ar_cus AS (
  SELECT a.id, a.code
  FROM accounts a, co
  WHERE a.company_id = co.company_id AND a.code ILIKE 'AR-CUS%'
)
SELECT
  COUNT(*) AS ar_cus_accounts,
  ROUND(COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0), 2) AS ar_cus_sum_net
FROM ar_cus ac
LEFT JOIN journal_entry_lines jel ON jel.account_id = ac.id
LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.company_id = (SELECT company_id FROM co)
  AND COALESCE(je.is_void, false) = false;

-- === 3. AP-SUP* sum vs 2000 control ===
WITH co AS (
  SELECT company_id FROM sales WHERE invoice_no IN ('HQ-SL-0003','SL-0001') LIMIT 1
),
ap_sup AS (
  SELECT a.id FROM accounts a, co
  WHERE a.company_id = co.company_id AND a.code ILIKE 'AP-SUP%'
),
ctrl2000 AS (
  SELECT a.id FROM accounts a, co WHERE a.company_id = co.company_id AND a.code = '2000' LIMIT 1
)
SELECT
  (SELECT ROUND(COALESCE(SUM(jel.credit), 0) - COALESCE(SUM(jel.debit), 0), 2)
   FROM ctrl2000 c
   LEFT JOIN journal_entry_lines jel ON jel.account_id = c.id
   LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.company_id = (SELECT company_id FROM co)
     AND COALESCE(je.is_void, false) = false) AS control_2000_net_credit,
  (SELECT ROUND(COALESCE(SUM(jel.credit), 0) - COALESCE(SUM(jel.debit), 0), 2)
   FROM ap_sup ac
   LEFT JOIN journal_entry_lines jel ON jel.account_id = ac.id
   LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.company_id = (SELECT company_id FROM co)
     AND COALESCE(je.is_void, false) = false) AS ap_sup_sum_net_credit;

-- === 4. Audit-only gl_correction / correction_reversal on AR-CUS (effective adjustment hint) ===
WITH co AS (
  SELECT company_id FROM sales WHERE invoice_no IN ('HQ-SL-0003','SL-0001') LIMIT 1
),
ar_cus AS (
  SELECT a.id, a.code FROM accounts a, co WHERE a.company_id = co.company_id AND a.code ILIKE 'AR-CUS%'
)
SELECT
  je.reference_type,
  COUNT(*) AS line_count,
  ROUND(SUM(jel.debit - jel.credit), 2) AS net_dr_minus_cr
FROM ar_cus ac
JOIN journal_entry_lines jel ON jel.account_id = ac.id
JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.company_id = (SELECT company_id FROM co)
WHERE COALESCE(je.is_void, false) = false
  AND je.reference_type IN ('gl_correction', 'correction_reversal')
GROUP BY je.reference_type
ORDER BY je.reference_type;
