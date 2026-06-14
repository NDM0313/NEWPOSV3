-- Customer balance tie-out: Inayat, Saqib, Walk-in (read-only)
--
-- Supabase SQL editor: run ONE section at a time.
-- VPS psql:
--   ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1" < scripts/sql/diag_customer_balance_tieout.sql

-- === 1. Contacts + linked AR accounts ===
WITH co AS (
  SELECT company_id FROM sales WHERE invoice_no IN ('HQ-SL-0003','SL-0001') LIMIT 1
)
SELECT
  c.code AS contact_code,
  c.name,
  a.code AS ar_account_code,
  a.id AS ar_account_id
FROM contacts c
CROSS JOIN co
LEFT JOIN accounts a ON a.company_id = c.company_id AND a.linked_contact_id = c.id
WHERE c.company_id = co.company_id
  AND (
    c.name ILIKE '%inayat%'
    OR c.name ILIKE '%saqib%'
    OR c.name ILIKE '%walk-in%'
    OR c.code IN ('CUS-0000', 'CUS0000')
  )
ORDER BY c.name;

-- === 2. AR subledger net by contact (official GL, void excluded) ===
WITH co AS (
  SELECT company_id FROM sales WHERE invoice_no IN ('HQ-SL-0003','SL-0001') LIMIT 1
),
targets AS (
  SELECT c.id AS contact_id, c.code, c.name, a.id AS account_id, a.code AS ar_code
  FROM contacts c
  CROSS JOIN co
  JOIN accounts a ON a.company_id = c.company_id AND a.linked_contact_id = c.id
  WHERE c.company_id = co.company_id
    AND (
      c.name ILIKE '%inayat%'
      OR c.name ILIKE '%saqib%'
      OR c.name ILIKE '%walk-in%'
    )
)
SELECT
  t.code,
  t.name,
  t.ar_code,
  ROUND(COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0), 2) AS gl_net_dr_minus_cr,
  COUNT(jel.id) AS line_count
FROM targets t
LEFT JOIN journal_entry_lines jel ON jel.account_id = t.account_id
LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.company_id = (SELECT company_id FROM co)
  AND COALESCE(je.is_void, false) = false
GROUP BY t.code, t.name, t.ar_code
ORDER BY t.name;

-- === 3. AR-CUS0000 residue lines (Walk-in / JE-0168 class) ===
WITH co AS (
  SELECT company_id FROM sales WHERE invoice_no IN ('HQ-SL-0003','SL-0001') LIMIT 1
),
ar_acc AS (
  SELECT a.id FROM accounts a, co WHERE a.company_id = co.company_id AND a.code ILIKE 'AR-CUS0000%' LIMIT 1
)
SELECT
  je.entry_date,
  je.entry_no,
  je.reference_type,
  je.description,
  ROUND(jel.debit::numeric, 2) AS debit,
  ROUND(jel.credit::numeric, 2) AS credit,
  ROUND((jel.debit - jel.credit)::numeric, 2) AS net_line
FROM ar_acc aa
JOIN journal_entry_lines jel ON jel.account_id = aa.id
JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.company_id = (SELECT company_id FROM co)
WHERE COALESCE(je.is_void, false) = false
ORDER BY je.entry_date, je.entry_no;
