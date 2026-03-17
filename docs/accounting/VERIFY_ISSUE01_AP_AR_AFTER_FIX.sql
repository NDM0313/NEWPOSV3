-- Verification: Issue 01 — AP/AR contamination fix
-- Run after migration 62 and code fixes. Expect: no sale/shipment/sale_extra_expense on AP (2000).

-- 1) Count of journal_entry_lines on AP (2000) by reference_type — should be 0 for sale, shipment, sale_extra_expense
SELECT
  a.code AS account_code,
  a.name AS account_name,
  je.reference_type,
  COUNT(*) AS line_count
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN accounts a ON a.id = jel.account_id
WHERE a.code = '2000'
GROUP BY a.code, a.name, je.reference_type
ORDER BY je.reference_type;

-- 2) Same for AR (1100) — sale/shipment/sale_extra_expense should appear here
SELECT
  a.code AS account_code,
  a.name AS account_name,
  je.reference_type,
  COUNT(*) AS line_count
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN accounts a ON a.id = jel.account_id
WHERE a.code = '1100'
GROUP BY a.code, a.name, je.reference_type
ORDER BY je.reference_type;

-- 3) Any line still on 2000 with sale/shipment/sale_extra_expense = FAIL (should return 0 rows)
SELECT jel.id, je.entry_no, je.reference_type, je.reference_id, a.code
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN accounts a ON a.id = jel.account_id
WHERE a.code = '2000'
  AND je.reference_type IN ('sale', 'shipment', 'sale_extra_expense');
