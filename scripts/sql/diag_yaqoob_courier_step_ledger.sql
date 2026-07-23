-- YAQOOB courier step-ledger diagnosis — read-only (DIN CHINA)
-- Run:
--   Get-Content scripts/sql/diag_yaqoob_courier_step_ledger.sql -Raw | ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres"

\set company_id '30bd8592-3384-4f34-899a-f3907e336485'
\set yaqoob_bank_id 'f08ae0ee-a156-4c6c-8607-4b02f0cc15fe'
\set purchase_id 'a065035c-dca2-4079-837a-9c2aeca9332d'
\set clearance_total 24573440.00

SELECT '=== 1. YAQOOB courier contact + 2031 payable ===' AS section;
SELECT c.id AS contact_id, c.name, a.id AS payable_id, a.code, a.balance
FROM contacts c
JOIN couriers co ON co.contact_id = c.id AND co.company_id = c.company_id
JOIN accounts a ON a.id = co.account_id
WHERE c.company_id = :'company_id'::uuid
  AND UPPER(TRIM(c.name)) = 'YAQOOB';

SELECT '=== 2. Voided YAQOOB funding transfers (target to restore) ===' AS section;
SELECT
  COUNT(*) AS voided_transfer_count,
  ROUND(COALESCE(SUM(jel.debit), 0)::numeric, 2) AS sum_dr_yaqoob_1204
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
WHERE je.company_id = :'company_id'::uuid
  AND je.is_void = true
  AND je.reference_type = 'transfer'
  AND COALESCE(je.void_reason, '') ILIKE '%YAQOOB%'
  AND jel.account_id = :'yaqoob_bank_id'::uuid
  AND jel.debit > 0;

SELECT '=== 3. Active YAQOOB funding transfers (if any) ===' AS section;
SELECT
  COUNT(*) AS active_transfer_count,
  ROUND(COALESCE(SUM(jel.debit), 0)::numeric, 2) AS sum_dr_yaqoob_1204
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
WHERE je.company_id = :'company_id'::uuid
  AND COALESCE(je.is_void, false) = false
  AND je.reference_type = 'transfer'
  AND EXISTS (
    SELECT 1 FROM journal_entry_lines y
    WHERE y.journal_entry_id = je.id
      AND y.account_id = :'yaqoob_bank_id'::uuid
      AND y.debit > 0
  )
  AND jel.account_id = :'yaqoob_bank_id'::uuid
  AND jel.debit > 0;

SELECT '=== 4. Transfer detail (voided, sample) ===' AS section;
SELECT je.id, je.entry_date, je.document_no, je.entry_no, je.is_void, je.void_reason,
       ROUND(jel.debit::numeric, 2) AS yaqoob_dr,
       ba.code AS bank_code, ba.name AS bank_name,
       ROUND(bc.credit::numeric, 2) AS bank_cr
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id AND jel.account_id = :'yaqoob_bank_id'::uuid AND jel.debit > 0
JOIN journal_entry_lines bc ON bc.journal_entry_id = je.id AND bc.credit > 0
JOIN accounts ba ON ba.id = bc.account_id
WHERE je.company_id = :'company_id'::uuid
  AND je.reference_type = 'transfer'
  AND je.is_void = true
  AND COALESCE(je.void_reason, '') ILIKE '%YAQOOB%'
ORDER BY je.entry_date, je.document_no
LIMIT 40;

SELECT '=== 5. PAY-0005/6/7 on 2031 (duplicate risk) ===' AS section;
SELECT je.document_no, je.entry_date, je.reference_type, je.is_void,
       ROUND(jel.debit::numeric, 2) AS debit_2031,
       ROUND(jel.credit::numeric, 2) AS credit_2031,
       p.amount AS payment_amount
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN accounts a ON a.id = jel.account_id
LEFT JOIN payments p ON p.id = je.payment_id
WHERE je.company_id = :'company_id'::uuid
  AND je.document_no IN ('PAY-0005', 'PAY-0006', 'PAY-0007')
  AND a.contact_id IS NOT NULL
  AND a.code ~ '^203[0-9]+$'
ORDER BY je.document_no;

SELECT '=== 6. 2031 accrual credits (purchase + journal) ===' AS section;
SELECT je.reference_type, je.document_no, je.entry_no, je.entry_date, je.is_void,
       ROUND(jel.credit::numeric, 2) AS credit_2031, jel.description
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN accounts a ON a.id = jel.account_id
JOIN contacts c ON c.id = a.contact_id
WHERE je.company_id = :'company_id'::uuid
  AND UPPER(TRIM(c.name)) = 'YAQOOB'
  AND jel.credit > 0
  AND COALESCE(je.is_void, false) = false
ORDER BY je.entry_date, je.document_no;

SELECT '=== 7. Current courier_ledger rows for YAQOOB ===' AS section;
SELECT date, payment_ref, entry_kind, reference_type,
       ROUND(debit::numeric, 2) AS debit,
       ROUND(credit::numeric, 2) AS credit,
       ROUND(balance::numeric, 2) AS balance,
       LEFT(description, 80) AS description
FROM courier_ledger
WHERE company_id = :'company_id'::uuid
  AND UPPER(TRIM(courier_name)) = 'YAQOOB'
ORDER BY date, journal_entry_id, journal_entry_line_id;

SELECT '=== 8. Tie-out summary ===' AS section;
WITH payable AS (
  SELECT a.id FROM accounts a
  JOIN contacts c ON c.id = a.contact_id
  WHERE a.company_id = :'company_id'::uuid AND UPPER(TRIM(c.name)) = 'YAQOOB' AND a.code ~ '^203[0-9]+$' AND a.code <> '2030'
  LIMIT 1
),
void_transfers AS (
  SELECT ROUND(COALESCE(SUM(jel.debit), 0)::numeric, 2) AS v
  FROM journal_entries je
  JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
  WHERE je.company_id = :'company_id'::uuid
    AND je.is_void = true AND je.reference_type = 'transfer'
    AND COALESCE(je.void_reason, '') ILIKE '%YAQOOB%'
    AND jel.account_id = :'yaqoob_bank_id'::uuid AND jel.debit > 0
),
pay_2031 AS (
  SELECT ROUND(COALESCE(SUM(jel.debit), 0)::numeric, 2) AS v
  FROM journal_entries je
  JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
  JOIN payable p ON p.id = jel.account_id
  WHERE je.company_id = :'company_id'::uuid
    AND COALESCE(je.is_void, false) = false
    AND je.document_no IN ('PAY-0005', 'PAY-0006', 'PAY-0007')
    AND jel.debit > 0
),
accrual_2031 AS (
  SELECT ROUND(COALESCE(SUM(jel.credit), 0)::numeric, 2) AS v
  FROM journal_entries je
  JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
  JOIN payable p ON p.id = jel.account_id
  WHERE je.company_id = :'company_id'::uuid
    AND COALESCE(je.is_void, false) = false
    AND jel.credit > 0
),
net_2031 AS (
  SELECT ROUND(COALESCE(SUM(jel.credit - jel.debit), 0)::numeric, 2) AS v
  FROM journal_entries je
  JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
  JOIN payable p ON p.id = jel.account_id
  WHERE je.company_id = :'company_id'::uuid
    AND COALESCE(je.is_void, false) = false
)
SELECT
  (SELECT v FROM void_transfers) AS void_transfer_sum,
  (SELECT v FROM pay_2031) AS pay_0005_6_7_debit_sum,
  (SELECT v FROM accrual_2031) AS accrual_credit_sum,
  (SELECT v FROM net_2031) AS net_2031_balance,
  :'clearance_total'::numeric AS clearance_target,
  CASE
    WHEN ABS((SELECT v FROM void_transfers) - :'clearance_total'::numeric) < 0.05 THEN 'PASS void_transfers ~= clearance'
    ELSE 'CHECK void_transfers vs clearance'
  END AS transfer_gate;
