-- DIN CHINA — PO2025/0003 purchase / courier / ledger trail (read-only)
-- Run:
--   Get-Content scripts/sql/diag_din_china_purchase_ledger_trail.sql -Raw | ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres"

\set company_id '30bd8592-3384-4f34-899a-f3907e336485'
\set branch_id '92f4184e-ee9b-4b6c-8e76-10ee1d166f55'
\set purchase_id 'a065035c-dca2-4079-837a-9c2aeca9332d'
\set supplier_ap_id 'ce35ae9e-de68-4be0-ae84-8c99463a1011'
\set expected_total 67978418.40
\set expected_goods_ap 43404978.40
\set expected_clearance 24573440.00
\set expected_due 2061978.40

SELECT '=== 1. Purchase header PO2025/0003 ===' AS section;
SELECT
  id,
  po_no,
  total,
  subtotal,
  discount_amount,
  tax_amount,
  shipping_cost,
  paid_amount,
  due_amount,
  freight_settlement,
  clearance_courier_id,
  supplier_id,
  supplier_name,
  status
FROM purchases
WHERE id = :'purchase_id'::uuid;

SELECT '=== 2. Canonical purchase JE (document, non-void) ===' AS section;
SELECT
  je.id,
  je.document_no,
  je.entry_no,
  je.entry_date,
  je.reference_type,
  ROUND(COALESCE(je.total_debit, 0)::numeric, 2) AS total_debit,
  ROUND(COALESCE(je.total_credit, 0)::numeric, 2) AS total_credit,
  je.is_void
FROM journal_entries je
WHERE je.company_id = :'company_id'::uuid
  AND je.reference_type = 'purchase'
  AND je.reference_id = :'purchase_id'::uuid
  AND je.payment_id IS NULL
ORDER BY je.created_at ASC;

SELECT '=== 3. JE-0001 line matrix (1200 / supplier AP / YAQOOB 2031) ===' AS section;
WITH purchase_je AS (
  SELECT je.id
  FROM journal_entries je
  WHERE je.company_id = :'company_id'::uuid
    AND je.reference_type = 'purchase'
    AND je.reference_id = :'purchase_id'::uuid
    AND je.payment_id IS NULL
    AND COALESCE(je.is_void, false) = false
  ORDER BY je.created_at ASC
  LIMIT 1
)
SELECT
  a.code,
  a.name,
  a.id AS account_id,
  ROUND(COALESCE(SUM(jel.debit), 0)::numeric, 2) AS debit,
  ROUND(COALESCE(SUM(jel.credit), 0)::numeric, 2) AS credit,
  ROUND(COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0), 2) AS net_dr_minus_cr
FROM journal_entry_lines jel
JOIN purchase_je pj ON pj.id = jel.journal_entry_id
JOIN accounts a ON a.id = jel.account_id
GROUP BY a.code, a.name, a.id
ORDER BY debit DESC, credit DESC;

SELECT '=== 4. Purchase JE balance gate (Dr = Cr = 67,978,418.40) ===' AS section;
WITH purchase_je AS (
  SELECT je.id
  FROM journal_entries je
  WHERE je.company_id = :'company_id'::uuid
    AND je.reference_type = 'purchase'
    AND je.reference_id = :'purchase_id'::uuid
    AND je.payment_id IS NULL
    AND COALESCE(je.is_void, false) = false
  ORDER BY je.created_at ASC
  LIMIT 1
)
SELECT
  ROUND(COALESCE(SUM(jel.debit), 0)::numeric, 2) AS sum_debit,
  ROUND(COALESCE(SUM(jel.credit), 0)::numeric, 2) AS sum_credit,
  ROUND(COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0), 2) AS imbalance,
  CASE
    WHEN ABS(COALESCE(SUM(jel.debit), 0) - :'expected_total'::numeric) < 0.05 THEN 'PASS total'
    ELSE 'FAIL total'
  END AS total_gate
FROM journal_entry_lines jel
JOIN purchase_je pj ON pj.id = jel.journal_entry_id;

SELECT '=== 5. PO-linked JEs — net per account ===' AS section;
SELECT
  a.code,
  a.name,
  je.reference_type,
  je.document_no,
  ROUND(COALESCE(SUM(jel.debit), 0)::numeric, 2) AS debit,
  ROUND(COALESCE(SUM(jel.credit), 0)::numeric, 2) AS credit
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN accounts a ON a.id = jel.account_id
WHERE je.company_id = :'company_id'::uuid
  AND COALESCE(je.is_void, false) = false
  AND (
    (je.reference_type = 'purchase' AND je.reference_id = :'purchase_id'::uuid)
    OR (je.reference_type IN ('purchase_payment', 'courier_payment', 'payment')
        AND je.reference_id = :'purchase_id'::uuid)
    OR je.id IN (
      SELECT p2.id FROM payments p
      JOIN journal_entries p2 ON p2.payment_id = p.id
      WHERE p.reference_id = :'purchase_id'::uuid
        AND p.company_id = :'company_id'::uuid
    )
  )
GROUP BY a.code, a.name, je.reference_type, je.document_no
ORDER BY je.document_no, a.code;

SELECT '=== 6. Payments PAY-0005..8 ===' AS section;
SELECT
  je.document_no,
  je.entry_date,
  p.amount,
  p.reference_type AS payment_ref_type,
  pa.code AS settlement_code,
  pa.name AS settlement_name,
  a.code AS gl_code,
  a.name AS gl_name,
  ROUND(jel.debit::numeric, 2) AS debit,
  ROUND(jel.credit::numeric, 2) AS credit
FROM payments p
JOIN journal_entries je ON je.payment_id = p.id
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN accounts a ON a.id = jel.account_id
LEFT JOIN accounts pa ON pa.id = p.payment_account_id
WHERE p.company_id = :'company_id'::uuid
  AND je.document_no IN ('PAY-0005', 'PAY-0006', 'PAY-0007', 'PAY-0008')
  AND COALESCE(je.is_void, false) = false
ORDER BY je.document_no, jel.debit DESC;

SELECT '=== 7. Cached vs computed balance (1200 / supplier AP / YAQOOB 2031) ===' AS section;
WITH targets AS (
  SELECT a.id, a.code, a.name, a.balance AS cached_balance
  FROM accounts a
  WHERE a.id = :'supplier_ap_id'::uuid
     OR (a.company_id = :'company_id'::uuid AND a.code = '1200')
     OR a.id IN (
       SELECT co.account_id
       FROM couriers co
       JOIN contacts c ON c.id = co.contact_id
       WHERE c.company_id = :'company_id'::uuid
         AND UPPER(TRIM(c.name)) = 'YAQOOB'
         AND c.type = 'courier'
     )
)
SELECT
  t.code,
  t.name,
  ROUND(COALESCE(t.cached_balance, 0)::numeric, 2) AS cached_balance,
  ROUND(COALESCE(SUM(jel.debit - jel.credit), 0)::numeric, 2) AS computed_asset_net_dr_minus_cr,
  ROUND(COALESCE(SUM(jel.credit - jel.debit), 0)::numeric, 2) AS computed_liability_net_cr_minus_dr,
  ROUND(
    COALESCE(t.cached_balance, 0)
    - CASE
        WHEN t.code = '1200' THEN COALESCE(SUM(jel.debit - jel.credit), 0)
        ELSE COALESCE(SUM(jel.credit - jel.debit), 0)
      END,
    2
  ) AS cache_drift
FROM targets t
LEFT JOIN journal_entry_lines jel ON jel.account_id = t.id
LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id AND COALESCE(je.is_void, false) = false
GROUP BY t.id, t.code, t.name, t.cached_balance
ORDER BY t.code;

SELECT '=== 8. Lines matching exactly 67,978,418.40 (debit or credit) ===' AS section;
SELECT
  a.code,
  a.name,
  je.document_no,
  je.entry_date,
  je.reference_type,
  jel.description,
  ROUND(jel.debit::numeric, 2) AS debit,
  ROUND(jel.credit::numeric, 2) AS credit
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN accounts a ON a.id = jel.account_id
WHERE je.company_id = :'company_id'::uuid
  AND COALESCE(je.is_void, false) = false
  AND (
    ABS(jel.debit - :'expected_total'::numeric) < 0.05
    OR ABS(jel.credit - :'expected_total'::numeric) < 0.05
  )
ORDER BY je.entry_date, je.document_no;

SELECT '=== 9. Supplier AP / clearance / due gates ===' AS section;
WITH purchase_je AS (
  SELECT je.id
  FROM journal_entries je
  WHERE je.company_id = :'company_id'::uuid
    AND je.reference_type = 'purchase'
    AND je.reference_id = :'purchase_id'::uuid
    AND je.payment_id IS NULL
    AND COALESCE(je.is_void, false) = false
  ORDER BY je.created_at ASC
  LIMIT 1
),
ap_cr AS (
  SELECT COALESCE(SUM(jel.credit), 0) AS v
  FROM journal_entry_lines jel
  JOIN purchase_je pj ON pj.id = jel.journal_entry_id
  WHERE jel.account_id = :'supplier_ap_id'::uuid
),
courier_cr AS (
  SELECT COALESCE(SUM(jel.credit), 0) AS v
  FROM journal_entry_lines jel
  JOIN purchase_je pj ON pj.id = jel.journal_entry_id
  JOIN couriers co ON co.account_id = jel.account_id
  JOIN contacts c ON c.id = co.contact_id
  WHERE c.company_id = :'company_id'::uuid AND UPPER(TRIM(c.name)) = 'YAQOOB'
),
inv_dr AS (
  SELECT COALESCE(SUM(jel.debit), 0) AS v
  FROM journal_entry_lines jel
  JOIN purchase_je pj ON pj.id = jel.journal_entry_id
  JOIN accounts a ON a.id = jel.account_id
  WHERE a.code = '1200'
)
SELECT
  (SELECT ROUND(v::numeric, 2) FROM inv_dr) AS inventory_dr,
  (SELECT ROUND(v::numeric, 2) FROM ap_cr) AS supplier_ap_cr,
  (SELECT ROUND(v::numeric, 2) FROM courier_cr) AS yaqoob_2031_cr,
  (SELECT due_amount FROM purchases WHERE id = :'purchase_id'::uuid) AS purchase_due_amount,
  CASE WHEN ABS((SELECT v FROM ap_cr) - :'expected_goods_ap'::numeric) < 0.05 THEN 'PASS' ELSE 'FAIL' END AS ap_cr_gate,
  CASE WHEN ABS((SELECT v FROM courier_cr) - :'expected_clearance'::numeric) < 0.05 THEN 'PASS' ELSE 'FAIL' END AS courier_cr_gate,
  CASE WHEN ABS((SELECT due_amount FROM purchases WHERE id = :'purchase_id'::uuid) - :'expected_due'::numeric) < 1 THEN 'PASS' ELSE 'FAIL' END AS due_gate;

SELECT '=== 10. Stock movements for PO2025/0003 ===' AS section;
SELECT
  COUNT(*) AS movement_rows,
  ROUND(COALESCE(SUM(sm.quantity), 0)::numeric, 4) AS qty_sum,
  ROUND(COALESCE(SUM(sm.total_cost), 0)::numeric, 2) AS total_cost_sum
FROM stock_movements sm
WHERE sm.company_id = :'company_id'::uuid
  AND sm.reference_type = 'purchase'
  AND sm.reference_id = :'purchase_id'::uuid;

SELECT '=== 11. Orphan opening_balance / stock_adjustment JEs (no movement) ===' AS section;
SELECT
  je.id,
  je.entry_no,
  je.document_no,
  je.reference_type,
  je.reference_id,
  je.entry_date,
  ROUND(COALESCE(je.total_debit, 0)::numeric, 2) AS je_amount
FROM journal_entries je
WHERE je.company_id = :'company_id'::uuid
  AND COALESCE(je.is_void, false) = false
  AND je.reference_type IN ('opening_balance', 'stock_adjustment')
  AND NOT EXISTS (
    SELECT 1 FROM stock_movements sm
    WHERE sm.id = je.reference_id
      AND sm.company_id = je.company_id
  )
ORDER BY je.entry_date DESC
LIMIT 50;

SELECT '=== 12. Trial balance gate (company, non-void) ===' AS section;
SELECT
  ROUND(COALESCE(SUM(jel.debit), 0)::numeric, 2) AS tb_debit,
  ROUND(COALESCE(SUM(jel.credit), 0)::numeric, 2) AS tb_credit,
  ROUND(COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0), 2) AS imbalance
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
WHERE je.company_id = :'company_id'::uuid
  AND COALESCE(je.is_void, false) = false;

SELECT '=== 13. Inventory 1200 — purchase vs COGS/sale activity (top refs) ===' AS section;
SELECT
  je.reference_type,
  COUNT(*) AS line_count,
  ROUND(COALESCE(SUM(jel.debit), 0)::numeric, 2) AS inv_dr,
  ROUND(COALESCE(SUM(jel.credit), 0)::numeric, 2) AS inv_cr,
  ROUND(COALESCE(SUM(jel.debit - jel.credit), 0)::numeric, 2) AS net_dr_minus_cr
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN accounts a ON a.id = jel.account_id
WHERE je.company_id = :'company_id'::uuid
  AND a.code = '1200'
  AND COALESCE(je.is_void, false) = false
GROUP BY je.reference_type
ORDER BY ABS(COALESCE(SUM(jel.debit - jel.credit), 0)) DESC;

SELECT '=== 14. Duplicate clearance accrual JE-0311 (should be void) ===' AS section;
SELECT
  je.id,
  je.document_no,
  je.entry_no,
  je.is_void,
  je.void_reason,
  ROUND(COALESCE(je.total_debit, 0)::numeric, 2) AS total_debit
FROM journal_entries je
WHERE je.company_id = :'company_id'::uuid
  AND (je.document_no = 'JE-0311' OR je.entry_no ILIKE '%0311%')
ORDER BY je.created_at;
