-- AR-CUS0000 Walk-in Customer reconciliation (read-only)
--
-- Supabase SQL editor: run ONE section at a time (select the query block, then Run).
--   Do not use psql meta-commands (\echo etc.) — they are not valid SQL.
--
-- VPS psql:
--   ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1" < scripts/sql/diag_ar_cus0000_reconciliation.sql

-- === 0. Walk-in contact + AR-CUS0000 account ===
WITH co AS (
  SELECT company_id FROM sales WHERE invoice_no IN ('HQ-SL-0003','SL-0001','SL-0013') LIMIT 1
)
SELECT
  c.id AS contact_id,
  c.code AS contact_code,
  c.name,
  c.type,
  c.is_system_generated,
  c.system_type,
  a.id AS ar_account_id,
  a.code AS ar_account_code,
  a.name AS ar_account_name
FROM contacts c
CROSS JOIN co
LEFT JOIN accounts a ON a.company_id = c.company_id
  AND (a.code ILIKE 'AR-CUS0000' OR a.code ILIKE 'AR-CUS-0000' OR a.linked_contact_id = c.id)
WHERE c.company_id = co.company_id
  AND (
    c.code IN ('CUS-0000', 'CUS0000')
    OR c.name ILIKE '%walk-in%'
    OR a.code ILIKE 'AR-CUS0000%'
  )
ORDER BY c.code, a.code;

-- === 1. AR-CUS0000 GL net (void excluded) ===
WITH co AS (
  SELECT company_id FROM sales WHERE invoice_no IN ('HQ-SL-0003','SL-0001') LIMIT 1
),
ar_acc AS (
  SELECT a.id, a.code, a.name
  FROM accounts a, co
  WHERE a.company_id = co.company_id AND a.code ILIKE 'AR-CUS0000%'
  LIMIT 1
)
SELECT
  aa.code,
  ROUND(COALESCE(SUM(jel.debit),0) - COALESCE(SUM(jel.credit),0), 2) AS net_dr_minus_cr,
  ROUND(COALESCE(SUM(jel.debit),0), 2) AS total_debit,
  ROUND(COALESCE(SUM(jel.credit),0), 2) AS total_credit,
  COUNT(*) FILTER (WHERE COALESCE(je.is_void,false)=false) AS active_lines,
  COUNT(*) FILTER (WHERE je.is_void=true) AS void_je_lines
FROM ar_acc aa
LEFT JOIN journal_entry_lines jel ON jel.account_id = aa.id
LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.company_id = (SELECT company_id FROM co)
GROUP BY aa.code;

-- === 2. All AR-CUS0000 lines 2016-01-01 to today ===
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
  je.reference_id,
  je.payment_id,
  je.is_void,
  je.description AS je_description,
  ROUND(jel.debit::numeric, 2) AS debit,
  ROUND(jel.credit::numeric, 2) AS credit,
  ROUND((jel.debit - jel.credit)::numeric, 2) AS net_line,
  p.reference_number AS payment_ref,
  p.voided_at AS payment_voided_at,
  p.contact_id AS payment_contact_id,
  s.invoice_no AS sale_invoice_no,
  s.status AS sale_status,
  s.due_amount AS sale_due,
  s.total AS sale_total,
  CASE WHEN COALESCE(je.is_void,false) THEN 'audit_only'
       WHEN lower(trim(COALESCE(je.reference_type,''))) = 'correction_reversal' THEN 'audit_only'
       WHEN p.voided_at IS NOT NULL THEN 'audit_only'
       WHEN lower(trim(COALESCE(s.status,''))) = 'cancelled'
         AND lower(trim(COALESCE(je.reference_type,''))) IN ('sale','sale_reversal','sale_return') THEN 'report_filter'
       ELSE 'normal' END AS normal_visibility,
  CASE WHEN je.is_void=true OR lower(trim(COALESCE(je.reference_type,'')))='correction_reversal' OR p.voided_at IS NOT NULL
       THEN 'audit' ELSE 'normal' END AS visibility_mode
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN ar_acc aa ON aa.id = jel.account_id
LEFT JOIN payments p ON p.id = je.payment_id
  OR (lower(trim(COALESCE(je.reference_type,''))) IN ('payment','manual_receipt','on_account') AND je.reference_id = p.id)
LEFT JOIN sales s ON s.id = je.reference_id AND lower(trim(COALESCE(je.reference_type,''))) IN ('sale','sale_reversal','sale_return')
  OR s.id = p.reference_id AND lower(trim(COALESCE(p.reference_type,''))) = 'sale'
WHERE je.company_id = (SELECT company_id FROM co)
  AND je.entry_date >= '2016-01-01'
  AND je.entry_date <= CURRENT_DATE
ORDER BY je.entry_date, je.entry_no, jel.id;

-- === 3. Normal vs Audit balance sums ===
WITH co AS (
  SELECT company_id FROM sales WHERE invoice_no IN ('HQ-SL-0003','SL-0001') LIMIT 1
),
ar_acc AS (
  SELECT a.id FROM accounts a, co WHERE a.company_id = co.company_id AND a.code ILIKE 'AR-CUS0000%' LIMIT 1
),
lines AS (
  SELECT
    jel.debit, jel.credit,
    je.is_void, je.reference_type,
    p.voided_at,
    s.status AS sale_status
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  JOIN ar_acc aa ON aa.id = jel.account_id
  LEFT JOIN payments p ON p.id = je.payment_id
    OR (lower(trim(COALESCE(je.reference_type,''))) IN ('payment','manual_receipt','on_account') AND je.reference_id = p.id)
  LEFT JOIN sales s ON s.id = je.reference_id
    AND lower(trim(COALESCE(je.reference_type,''))) IN ('sale','sale_reversal','sale_return')
  WHERE je.company_id = (SELECT company_id FROM co)
    AND je.entry_date >= '2016-01-01'
)
SELECT
  ROUND(SUM(CASE WHEN COALESCE(is_void,false)=false
    AND lower(trim(COALESCE(reference_type,''))) <> 'correction_reversal'
    AND voided_at IS NULL
    AND NOT (lower(trim(COALESCE(sale_status,''))) = 'cancelled'
      AND lower(trim(COALESCE(reference_type,''))) IN ('sale','sale_reversal','sale_return'))
    THEN debit - credit ELSE 0 END), 2) AS normal_net_balance,
  ROUND(SUM(CASE WHEN is_void=true
    OR lower(trim(COALESCE(reference_type,''))) = 'correction_reversal'
    OR voided_at IS NOT NULL THEN debit - credit ELSE 0 END), 2) AS audit_only_net,
  ROUND(SUM(CASE WHEN lower(trim(COALESCE(sale_status,''))) = 'cancelled'
    AND lower(trim(COALESCE(reference_type,''))) IN ('sale','sale_reversal','sale_return')
    AND COALESCE(is_void,false)=false AND voided_at IS NULL
    THEN debit - credit ELSE 0 END), 2) AS report_filter_cancelled_sale_net,
  ROUND(SUM(debit - credit), 2) AS all_lines_net_including_void
FROM lines;

-- === 4. Target trace: HQ-SL-0003, HQ-SL-0004, SL-0001 ===
WITH co AS (SELECT company_id FROM sales WHERE invoice_no = 'HQ-SL-0003' LIMIT 1)
SELECT 'sale' AS kind, s.invoice_no AS ref, s.status, s.total, s.paid_amount, s.due_amount,
  je.entry_no, je.reference_type, je.is_void, je.id AS je_id
FROM sales s
LEFT JOIN journal_entries je ON je.reference_id = s.id AND je.reference_type = 'sale' AND je.company_id = s.company_id
WHERE s.invoice_no IN ('HQ-SL-0003','HQ-SL-0004','SL-0001')
UNION ALL
SELECT 'payment', p.reference_number, p.reference_type, p.amount, NULL, NULL,
  je.entry_no, je.reference_type, je.is_void, je.id
FROM payments p
LEFT JOIN journal_entries je ON je.payment_id = p.id OR (je.reference_type='payment' AND je.reference_id=p.id)
WHERE p.reference_number IN ('RCV-0001','RCV-0006','RCV-0012','RCV-0014','RCV-0016')
   OR p.reference_number ILIKE '%RCV%0001%'
ORDER BY ref;

-- === 5. JE-0168 / RCV-0001 chain ===
SELECT
  je.entry_no, je.entry_date, je.reference_type, je.reference_id, je.is_void, je.description,
  je.payment_id,
  p.reference_number AS payment_ref, p.voided_at,
  jel.account_id, a.code AS account_code, jel.debit, jel.credit
FROM journal_entries je
LEFT JOIN payments p ON p.id = je.payment_id OR je.reference_id = p.id
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN accounts a ON a.id = jel.account_id
WHERE je.entry_no IN ('JE-0168','JE-0167','JE-0169')
   OR p.reference_number = 'RCV-0001'
ORDER BY je.entry_no, a.code;

-- === 6. RCV-0006/SL-0013, RCV-0012/SL-0002, RCV-0014/SL-0015, RCV-0016/SL-0016 ===
SELECT
  p.reference_number AS rcv,
  p.amount AS pay_amt,
  p.voided_at,
  p.contact_id,
  c.code AS contact_code,
  c.name AS contact_name,
  s.invoice_no AS sale_no,
  s.status AS sale_status,
  s.due_amount,
  je.entry_no,
  je.reference_type,
  je.is_void AS je_void,
  (SELECT ROUND(SUM(jel2.debit-jel2.credit),2) FROM journal_entry_lines jel2
   JOIN accounts a2 ON a2.id=jel2.account_id
   WHERE jel2.journal_entry_id=je.id AND a2.code ILIKE 'AR-CUS0000%') AS ar_cus0000_net_on_je
FROM payments p
LEFT JOIN contacts c ON c.id = p.contact_id
LEFT JOIN sales s ON s.id = p.reference_id AND lower(trim(p.reference_type))='sale'
LEFT JOIN journal_entries je ON je.payment_id = p.id AND COALESCE(je.is_void,false)=false
WHERE p.reference_number IN ('RCV-0006','RCV-0012','RCV-0014','RCV-0016')
   OR s.invoice_no IN ('SL-0013','SL-0002','SL-0015','SL-0016','HQ-SL-0003','HQ-SL-0004','SL-0001')
ORDER BY p.reference_number NULLS LAST, s.invoice_no;

-- === 7. Open sales on walk-in customer ===
WITH co AS (SELECT company_id FROM sales WHERE invoice_no = 'HQ-SL-0003' LIMIT 1),
walkin AS (
  SELECT id FROM contacts c, co WHERE c.company_id=co.company_id AND (c.code='CUS-0000' OR c.name ILIKE '%walk-in%') LIMIT 1
)
SELECT s.invoice_no, s.status, s.total, s.paid_amount, s.due_amount, s.invoice_date,
  EXISTS(SELECT 1 FROM journal_entries je WHERE je.reference_id=s.id AND je.reference_type='sale' AND COALESCE(je.is_void,false)=false) AS has_live_je
FROM sales s, walkin w
WHERE s.customer_id = w.id AND s.due_amount > 0
ORDER BY s.invoice_date;

-- === 8. Party mapping on AR-CUS0000 unmapped lines (skip if view missing) ===
SELECT v.entry_no, v.journal_line_id, v.account_code, v.debit, v.credit,
  v.linked_contact_id, v.linked_contact_name, v.control_bucket
FROM v_ar_ap_unmapped_journals v
WHERE v.account_code ILIKE 'AR-CUS0000%'
ORDER BY v.entry_no;
