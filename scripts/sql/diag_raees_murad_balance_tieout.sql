-- RAEES / MURAD balance tie-out (read-only)
--
-- Supabase SQL editor: run ONE section at a time.
-- VPS psql:
--   ssh dincouture-vps "docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1" < scripts/sql/diag_raees_murad_balance_tieout.sql

-- === 0. Resolve company from target contacts ===
WITH targets AS (
  SELECT DISTINCT c.company_id
  FROM contacts c
  WHERE c.name ILIKE '%raees%'
     OR c.name ILIKE '%murad%ramdas%'
     OR c.code IN ('C00151', 'C00152')
  LIMIT 1
)
SELECT company_id FROM targets;

-- === 1. Contacts + linked party accounts ===
WITH co AS (
  SELECT DISTINCT c.company_id
  FROM contacts c
  WHERE c.name ILIKE '%raees%'
     OR c.name ILIKE '%murad%'
     OR c.code IN ('C00151', 'C00152')
  LIMIT 1
)
SELECT
  c.id AS contact_id,
  c.code AS contact_code,
  c.name,
  c.type,
  a.id AS account_id,
  a.code AS account_code,
  a.name AS account_name,
  a.parent_id
FROM contacts c
CROSS JOIN co
LEFT JOIN accounts a ON a.company_id = c.company_id AND a.linked_contact_id = c.id
WHERE c.company_id = co.company_id
  AND (
    c.name ILIKE '%raees%'
    OR c.name ILIKE '%murad%ramdas%'
    OR c.name ILIKE '%murad%'
    OR c.code IN ('C00151', 'C00152')
  )
ORDER BY c.name;

-- === 2. GL net on linked party account (void excluded, all branches) ===
WITH co AS (
  SELECT DISTINCT c.company_id
  FROM contacts c
  WHERE c.name ILIKE '%raees%' OR c.name ILIKE '%murad%' OR c.code IN ('C00151', 'C00152')
  LIMIT 1
),
targets AS (
  SELECT c.id AS contact_id, c.code, c.name, a.id AS account_id, a.code AS ar_code
  FROM contacts c
  CROSS JOIN co
  JOIN accounts a ON a.company_id = c.company_id AND a.linked_contact_id = c.id
  WHERE c.company_id = co.company_id
    AND (c.name ILIKE '%raees%' OR c.name ILIKE '%murad%' OR c.code IN ('C00151', 'C00152'))
)
SELECT
  t.code,
  t.name,
  t.ar_code,
  ROUND(COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0), 2) AS gl_net_dr_minus_cr,
  ROUND(COALESCE(SUM(jel.debit), 0), 2) AS total_debit,
  ROUND(COALESCE(SUM(jel.credit), 0), 2) AS total_credit,
  COUNT(jel.id) AS line_count
FROM targets t
LEFT JOIN journal_entry_lines jel ON jel.account_id = t.account_id
LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id
  AND je.company_id = (SELECT company_id FROM co)
  AND COALESCE(je.is_void, false) = false
GROUP BY t.code, t.name, t.ar_code
ORDER BY t.name;

-- === 3. RPC: get_contact_party_gl_balances (as of today) ===
WITH co AS (
  SELECT DISTINCT c.company_id
  FROM contacts c
  WHERE c.name ILIKE '%raees%' OR c.name ILIKE '%murad%' OR c.code IN ('C00151', 'C00152')
  LIMIT 1
),
targets AS (
  SELECT c.id AS contact_id, c.code, c.name
  FROM contacts c, co
  WHERE c.company_id = co.company_id
    AND (c.name ILIKE '%raees%' OR c.name ILIKE '%murad%' OR c.code IN ('C00151', 'C00152'))
)
SELECT
  t.code,
  t.name,
  b.gl_ar_receivable,
  b.gl_ap_payable,
  b.gl_worker_payable
FROM targets t
LEFT JOIN LATERAL (
  SELECT * FROM get_contact_party_gl_balances((SELECT company_id FROM co), NULL::uuid, CURRENT_DATE)
  WHERE contact_id = t.contact_id
) b ON true;

-- === 4. Operational due via get_contact_balances_summary ===
WITH co AS (
  SELECT DISTINCT c.company_id
  FROM contacts c
  WHERE c.name ILIKE '%raees%' OR c.name ILIKE '%murad%' OR c.code IN ('C00151', 'C00152')
  LIMIT 1
),
targets AS (
  SELECT c.id AS contact_id, c.code, c.name
  FROM contacts c, co
  WHERE c.company_id = co.company_id
    AND (c.name ILIKE '%raees%' OR c.name ILIKE '%murad%' OR c.code IN ('C00151', 'C00152'))
)
SELECT
  t.code,
  t.name,
  s.receivables,
  s.payables
FROM targets t
LEFT JOIN get_contact_balances_summary((SELECT company_id FROM co), NULL) s ON s.contact_id = t.contact_id;

-- === 5. Open final sales with due > 0 ===
WITH co AS (
  SELECT DISTINCT c.company_id
  FROM contacts c
  WHERE c.name ILIKE '%raees%' OR c.name ILIKE '%murad%' OR c.code IN ('C00151', 'C00152')
  LIMIT 1
),
targets AS (
  SELECT c.id AS contact_id, c.code, c.name
  FROM contacts c, co
  WHERE c.company_id = co.company_id
    AND (c.name ILIKE '%raees%' OR c.name ILIKE '%murad%' OR c.code IN ('C00151', 'C00152'))
)
SELECT
  t.code,
  t.name,
  s.invoice_no,
  s.status,
  s.total,
  s.paid_amount,
  s.due_amount,
  s.invoice_date
FROM targets t
JOIN sales s ON s.customer_id = t.contact_id AND s.company_id = (SELECT company_id FROM co)
WHERE s.status = 'final' AND COALESCE(s.due_amount, 0) > 0.01
ORDER BY t.name, s.invoice_date;

-- === 6. Line-level residue on party accounts (non-zero running context) ===
WITH co AS (
  SELECT DISTINCT c.company_id
  FROM contacts c
  WHERE c.name ILIKE '%raees%' OR c.name ILIKE '%murad%' OR c.code IN ('C00151', 'C00152')
  LIMIT 1
),
targets AS (
  SELECT c.id AS contact_id, c.code, c.name, a.id AS account_id, a.code AS ar_code
  FROM contacts c
  CROSS JOIN co
  JOIN accounts a ON a.company_id = c.company_id AND a.linked_contact_id = c.id
  WHERE c.company_id = co.company_id
    AND (c.name ILIKE '%raees%' OR c.name ILIKE '%murad%' OR c.code IN ('C00151', 'C00152'))
)
SELECT
  t.code AS contact_code,
  t.name,
  je.entry_date,
  je.entry_no,
  je.reference_type,
  je.reference_id,
  je.payment_id,
  je.branch_id,
  je.description,
  ROUND(jel.debit::numeric, 2) AS debit,
  ROUND(jel.credit::numeric, 2) AS credit,
  ROUND((jel.debit - jel.credit)::numeric, 2) AS net_line
FROM targets t
JOIN journal_entry_lines jel ON jel.account_id = t.account_id
JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.company_id = (SELECT company_id FROM co)
WHERE COALESCE(je.is_void, false) = false
ORDER BY t.name, je.entry_date, je.entry_no;

-- === 7. TB-style period net (wide range) per party account ===
WITH co AS (
  SELECT DISTINCT c.company_id
  FROM contacts c
  WHERE c.name ILIKE '%raees%' OR c.name ILIKE '%murad%' OR c.code IN ('C00151', 'C00152')
  LIMIT 1
),
targets AS (
  SELECT c.id AS contact_id, c.code, c.name, a.id AS account_id, a.code AS ar_code
  FROM contacts c
  CROSS JOIN co
  JOIN accounts a ON a.company_id = c.company_id AND a.linked_contact_id = c.id
  WHERE c.company_id = co.company_id
    AND (c.name ILIKE '%raees%' OR c.name ILIKE '%murad%' OR c.code IN ('C00151', 'C00152'))
)
SELECT
  t.ar_code,
  t.name,
  ROUND(COALESCE(SUM(jel.debit), 0), 2) AS period_debit,
  ROUND(COALESCE(SUM(jel.credit), 0), 2) AS period_credit,
  ROUND(COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0), 2) AS tb_balance
FROM targets t
LEFT JOIN journal_entry_lines jel ON jel.account_id = t.account_id
LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id
  AND je.company_id = (SELECT company_id FROM co)
  AND COALESCE(je.is_void, false) = false
  AND je.entry_date >= '2016-01-01'
  AND je.entry_date <= CURRENT_DATE
GROUP BY t.ar_code, t.name
ORDER BY t.name;
