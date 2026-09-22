-- Post-repair acceptance gates for DIN CHINA PO2025/0003
\set company_id '30bd8592-3384-4f34-899a-f3907e336485'
\set purchase_id 'a065035c-dca2-4079-837a-9c2aeca9332d'
\set expected_total 67978418.40
\set expected_due 2061978.40

SELECT 'purchase_header' AS gate,
  CASE WHEN ABS(total - :'expected_total'::numeric) < 0.05
    AND ABS(due_amount - :'expected_due'::numeric) < 1
    AND freight_settlement = 'courier'
  THEN 'PASS' ELSE 'FAIL' END AS status,
  total, due_amount, freight_settlement
FROM purchases WHERE id = :'purchase_id'::uuid;

SELECT 'inventory_1200_purchase_dr' AS gate,
  CASE WHEN EXISTS (
    SELECT 1 FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    JOIN accounts a ON a.id = jel.account_id
    WHERE je.reference_type = 'purchase' AND je.reference_id = :'purchase_id'::uuid
      AND a.code = '1200' AND ABS(jel.debit - :'expected_total'::numeric) < 0.05
      AND COALESCE(je.is_void, false) = false
  ) THEN 'PASS' ELSE 'FAIL' END AS status;

SELECT 'supplier_ap_net' AS gate,
  ROUND(COALESCE(SUM(jel.credit - jel.debit), 0)::numeric, 2) AS liability_net,
  CASE WHEN ABS(COALESCE(SUM(jel.credit - jel.debit), 0) - :'expected_due'::numeric) < 1
  THEN 'PASS' ELSE 'FAIL' END AS status
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
WHERE jel.account_id = 'ce35ae9e-de68-4be0-ae84-8c99463a1011'::uuid
  AND je.company_id = :'company_id'::uuid
  AND COALESCE(je.is_void, false) = false;

SELECT 'yaqoob_2031_net' AS gate,
  ROUND(COALESCE(SUM(jel.credit - jel.debit), 0)::numeric, 2) AS liability_net,
  CASE WHEN ABS(COALESCE(SUM(jel.credit - jel.debit), 0)) < 0.05 THEN 'PASS' ELSE 'FAIL' END AS status
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN accounts a ON a.id = jel.account_id
WHERE je.company_id = :'company_id'::uuid
  AND a.code = '2031'
  AND COALESCE(je.is_void, false) = false;

SELECT 'trial_balance' AS gate,
  ROUND(COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0), 2) AS imbalance,
  CASE WHEN ABS(COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0)) < 0.05
  THEN 'PASS' ELSE 'FAIL' END AS status
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
WHERE je.company_id = :'company_id'::uuid
  AND COALESCE(je.is_void, false) = false;

SELECT 'orphan_opening_inv_jes' AS gate,
  COUNT(*) AS orphan_count,
  CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM journal_entries je
WHERE je.company_id = :'company_id'::uuid
  AND COALESCE(je.is_void, false) = false
  AND je.reference_type = 'opening_balance_inventory'
  AND NOT EXISTS (SELECT 1 FROM stock_movements sm WHERE sm.id = je.reference_id);
