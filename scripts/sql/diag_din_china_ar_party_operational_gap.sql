-- DIN CHINA — AR party GL vs operational due gap (read-only)
-- Same root cause as RAEES: sale JE debited AR-* but payment credited control 1100.
--
-- VPS:
--   ssh dincouture-vps "docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1" < scripts/sql/diag_din_china_ar_party_operational_gap.sql

\set company_id '30bd8592-3384-4f34-899a-f3907e336485'
\set branch_id '92f4184e-ee9b-4b6c-8e76-10ee1d166f55'

-- === 1. Per-customer: party sub-ledger net vs sum(sales.due_amount) ===
WITH party_accts AS (
  SELECT a.id AS account_id, a.code AS ar_code, c.id AS contact_id, c.name
  FROM accounts a
  JOIN contacts c ON c.id = a.linked_contact_id AND c.company_id = a.company_id
  WHERE a.company_id = :'company_id'::uuid
),
party_gl AS (
  SELECT
    p.contact_id,
    p.name,
    p.ar_code,
    ROUND(COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0), 2) AS gl_net
  FROM party_accts p
  LEFT JOIN journal_entry_lines jel ON jel.account_id = p.account_id
  LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id
    AND je.company_id = :'company_id'::uuid
    AND COALESCE(je.is_void, false) = false
  GROUP BY p.contact_id, p.name, p.ar_code
),
sale_due AS (
  SELECT
    s.customer_id AS contact_id,
    ROUND(COALESCE(SUM(s.due_amount), 0), 2) AS operational_due
  FROM sales s
  WHERE s.company_id = :'company_id'::uuid
    AND s.branch_id = :'branch_id'::uuid
    AND s.status = 'final'
    AND s.cancelled_at IS NULL
  GROUP BY s.customer_id
)
SELECT
  g.name,
  g.ar_code,
  g.gl_net,
  COALESCE(d.operational_due, 0) AS operational_due,
  ROUND(g.gl_net - COALESCE(d.operational_due, 0), 2) AS gap_gl_minus_due
FROM party_gl g
LEFT JOIN sale_due d ON d.contact_id = g.contact_id
WHERE ABS(g.gl_net - COALESCE(d.operational_due, 0)) > 0.01
ORDER BY ABS(g.gl_net - COALESCE(d.operational_due, 0)) DESC;

-- === 2. Payment AR credits on control 1100 for sales that debited party AR-* ===
WITH ar_control AS (
  SELECT id FROM accounts
  WHERE company_id = :'company_id'::uuid AND TRIM(code) = '1100'
  LIMIT 1
),
party_accts AS (
  SELECT a.id AS party_account_id, a.code AS party_code, c.id AS contact_id
  FROM accounts a
  JOIN contacts c ON c.id = a.linked_contact_id
  WHERE a.company_id = :'company_id'::uuid
),
sale_party_dr AS (
  SELECT DISTINCT
    s.id AS sale_id,
    s.invoice_no,
    s.customer_id,
    pa.party_account_id,
    pa.party_code
  FROM sales s
  JOIN party_accts pa ON pa.contact_id = s.customer_id
  JOIN journal_entries je ON je.company_id = s.company_id
    AND COALESCE(je.is_void, false) = false
    AND je.reference_type = 'sale'
    AND (je.reference_id = s.id OR je.description ILIKE '%' || s.invoice_no || '%')
  JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
    AND jel.account_id = pa.party_account_id
    AND jel.debit > 0
  WHERE s.company_id = :'company_id'::uuid
    AND s.branch_id = :'branch_id'::uuid
    AND s.status = 'final'
)
SELECT
  spd.invoice_no,
  spd.party_code,
  p.reference_number AS payment_ref,
  je.entry_no,
  ROUND(jel.credit::numeric, 2) AS credit_on_1100,
  jel.id AS line_id
FROM sale_party_dr spd
JOIN payments p ON p.reference_type = 'sale' AND p.reference_id = spd.sale_id
  AND p.company_id = :'company_id'::uuid
  AND p.voided_at IS NULL
JOIN journal_entries je ON je.payment_id = p.id AND COALESCE(je.is_void, false) = false
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN ar_control ac ON jel.account_id = ac.id
WHERE jel.credit > 0
ORDER BY credit_on_1100 DESC;
