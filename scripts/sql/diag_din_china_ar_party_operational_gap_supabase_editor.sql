-- DIN CHINA — AR party GL vs operational due gap (Supabase SQL Editor)
-- Run ONE query block at a time (select the block, then Run).
-- company: 30bd8592-3384-4f34-899a-f3907e336485
-- branch:  92f4184e-ee9b-4b6c-8e76-10ee1d166f55

-- === BLOCK 1: Per-customer party GL net vs sum(sales.due_amount) ===
WITH party_accts AS (
  SELECT a.id AS account_id, a.code AS ar_code, c.id AS contact_id, c.name
  FROM accounts a
  JOIN contacts c ON c.id = a.linked_contact_id AND c.company_id = a.company_id
  WHERE a.company_id = '30bd8592-3384-4f34-899a-f3907e336485'::uuid
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
    AND je.company_id = '30bd8592-3384-4f34-899a-f3907e336485'::uuid
    AND COALESCE(je.is_void, false) = false
  GROUP BY p.contact_id, p.name, p.ar_code
),
sale_due AS (
  SELECT
    s.customer_id AS contact_id,
    ROUND(COALESCE(SUM(s.due_amount), 0), 2) AS operational_due
  FROM sales s
  WHERE s.company_id = '30bd8592-3384-4f34-899a-f3907e336485'::uuid
    AND s.branch_id = '92f4184e-ee9b-4b6c-8e76-10ee1d166f55'::uuid
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

-- === BLOCK 2: Payment AR credits on control 1100 (candidates for Phase 4 reclass) ===
WITH ar_control AS (
  SELECT id FROM accounts
  WHERE company_id = '30bd8592-3384-4f34-899a-f3907e336485'::uuid AND TRIM(code) = '1100'
  LIMIT 1
),
party_accts AS (
  SELECT a.id AS party_account_id, a.code AS party_code, c.id AS contact_id
  FROM accounts a
  JOIN contacts c ON c.id = a.linked_contact_id
  WHERE a.company_id = '30bd8592-3384-4f34-899a-f3907e336485'::uuid
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
  WHERE s.company_id = '30bd8592-3384-4f34-899a-f3907e336485'::uuid
    AND s.branch_id = '92f4184e-ee9b-4b6c-8e76-10ee1d166f55'::uuid
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
  AND p.company_id = '30bd8592-3384-4f34-899a-f3907e336485'::uuid
  AND p.voided_at IS NULL
JOIN journal_entries je ON je.payment_id = p.id AND COALESCE(je.is_void, false) = false
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN ar_control ac ON jel.account_id = ac.id
WHERE jel.credit > 0
ORDER BY credit_on_1100 DESC;

-- === BLOCK 3: Spotlight customers (AZIZ, SHAHURKH, LAL) before Phase 4 ===
SELECT
  c.name,
  a.code AS ar_code,
  ROUND(COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0), 2) AS party_gl_net,
  pg.gl_ar_receivable AS rpc_ar
FROM contacts c
JOIN accounts a ON a.linked_contact_id = c.id AND a.company_id = c.company_id
LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id
  AND je.company_id = c.company_id
  AND COALESCE(je.is_void, false) = false
LEFT JOIN LATERAL (
  SELECT gl_ar_receivable
  FROM get_contact_party_gl_balances(c.company_id, NULL, NULL) b
  WHERE b.contact_id = c.id
  LIMIT 1
) pg ON true
WHERE c.company_id = '30bd8592-3384-4f34-899a-f3907e336485'::uuid
  AND a.code IN ('AR-A987EE', 'AR-2BA4BA', 'AR-F8FD5E')
GROUP BY c.name, a.code, pg.gl_ar_receivable
ORDER BY c.name;
