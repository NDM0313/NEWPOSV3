-- YAQOOB courier step-ledger verification — read-only
-- Run after repair_yaqoob_courier_step_ledger.sql

\set company_id '30bd8592-3384-4f34-899a-f3907e336485'
\set yaqoob_bank_id 'f08ae0ee-a156-4c6c-8607-4b02f0cc15fe'
\set clearance_total 24573440.00

SELECT 'yaqoob_1204_net' AS gate,
  ROUND(COALESCE(SUM(jel.debit - jel.credit), 0)::numeric, 2) AS value,
  CASE WHEN ABS(COALESCE(SUM(jel.debit - jel.credit), 0)) < 0.02 THEN 'PASS' ELSE 'FAIL' END AS status
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
WHERE je.company_id = :'company_id'::uuid
  AND jel.account_id = :'yaqoob_bank_id'::uuid
  AND COALESCE(je.is_void, false) = false;

SELECT 'yaqoob_2031_net' AS gate,
  ROUND(COALESCE(SUM(jel.credit - jel.debit), 0)::numeric, 2) AS value,
  CASE WHEN ABS(COALESCE(SUM(jel.credit - jel.debit), 0)) < 0.02 THEN 'PASS' ELSE 'FAIL' END AS status
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN accounts a ON a.id = jel.account_id
JOIN contacts c ON c.id = a.contact_id
WHERE je.company_id = :'company_id'::uuid
  AND UPPER(TRIM(c.name)) = 'YAQOOB'
  AND COALESCE(je.is_void, false) = false;

SELECT 'lump_pay_voided' AS gate,
  COUNT(*) FILTER (WHERE COALESCE(is_void, false) = false) AS active_count,
  CASE WHEN COUNT(*) FILTER (WHERE COALESCE(is_void, false) = false) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM journal_entries
WHERE company_id = :'company_id'::uuid
  AND document_no IN ('PAY-0005', 'PAY-0006', 'PAY-0007');

SELECT 'step_payment_count' AS gate,
  COUNT(*) AS value,
  CASE WHEN COUNT(*) >= 30 THEN 'PASS' ELSE 'FAIL' END AS status
FROM journal_entries je
WHERE je.company_id = :'company_id'::uuid
  AND je.reference_type = 'courier_payment'
  AND COALESCE(je.is_void, false) = false
  AND je.description ILIKE '%YAQOOB%';

SELECT 'courier_ledger_row_count' AS gate,
  COUNT(*) AS value,
  CASE WHEN COUNT(*) >= 30 THEN 'PASS' ELSE 'FAIL' END AS status
FROM courier_ledger
WHERE company_id = :'company_id'::uuid
  AND UPPER(TRIM(courier_name)) = 'YAQOOB';

SELECT 'courier_ledger_final_balance' AS gate,
  ROUND(last.balance::numeric, 2) AS value,
  CASE WHEN ABS(last.balance) < 0.02 THEN 'PASS' ELSE 'FAIL' END AS status
FROM (
  SELECT balance
  FROM courier_ledger
  WHERE company_id = :'company_id'::uuid
    AND UPPER(TRIM(courier_name)) = 'YAQOOB'
  ORDER BY date DESC, journal_entry_id DESC, journal_entry_line_id DESC
  LIMIT 1
) last;

SELECT '=== Step ledger (chronological) ===' AS section;
SELECT date, payment_ref, entry_kind,
       ROUND(debit::numeric, 2) AS debit,
       ROUND(credit::numeric, 2) AS credit,
       ROUND(balance::numeric, 2) AS balance,
       LEFT(description, 70) AS description
FROM courier_ledger
WHERE company_id = :'company_id'::uuid
  AND UPPER(TRIM(courier_name)) = 'YAQOOB'
ORDER BY date, journal_entry_id, journal_entry_line_id;
