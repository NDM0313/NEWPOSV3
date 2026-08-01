-- AR/AP Phase 2.1 — Saqib / RCV-0008 read-only diagnostic
-- Run (VPS): Get-Content scripts/sql/diag_ar_ap_saqib_rcv0008.sql | ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres"
-- Supabase SQL editor: run section-by-section (SELECT only)

SELECT '=== 1. Contact + AR account AR-CUS0060 ===' AS audit_section;
SELECT
  c.id AS contact_id,
  c.name AS contact_name,
  a.id AS account_id,
  a.code AS account_code,
  a.name AS account_name,
  a.linked_contact_id
FROM accounts a
LEFT JOIN contacts c ON c.id = a.linked_contact_id
WHERE a.code = 'AR-CUS0060'
   OR lower(c.name) LIKE '%saqib%';

SELECT '=== 2. Rental REN-0004 (booking_no) ===' AS audit_section;
SELECT
  r.id,
  r.booking_no,
  r.status,
  r.customer_id,
  r.customer_name,
  r.rental_charges,
  r.total_amount,
  r.paid_amount,
  r.due_amount,
  r.damage_charges,
  r.late_fee,
  r.penalty_paid,
  r.pickup_date,
  r.return_date,
  r.actual_return_date,
  r.branch_id,
  b.name AS branch_name
FROM rentals r
LEFT JOIN branches b ON b.id = r.branch_id
WHERE r.booking_no = 'REN-0004'
   OR r.customer_name ILIKE '%saqib%'
ORDER BY r.booking_no;

SELECT '=== 3. Payment RCV-0008 ===' AS audit_section;
SELECT
  p.id,
  p.reference_number,
  p.payment_date,
  p.amount,
  p.payment_type,
  p.reference_type,
  p.reference_id,
  p.contact_id,
  c.name AS contact_name,
  p.payment_account_id,
  a.code AS cash_account_code,
  a.name AS cash_account_name,
  p.branch_id,
  p.voided_at,
  p.notes
FROM payments p
LEFT JOIN contacts c ON c.id = p.contact_id
LEFT JOIN accounts a ON a.id = p.payment_account_id
WHERE p.reference_number IN ('RCV-0008', 'HQ-RCV-0008')
ORDER BY p.reference_number;

SELECT '=== 4. rental_payments for REN-0004 ===' AS audit_section;
SELECT
  rp.id,
  rp.rental_id,
  r.booking_no,
  rp.reference,
  rp.payment_date,
  rp.amount,
  rp.payment_type,
  rp.method,
  rp.journal_entry_id,
  rp.voided_at
FROM rental_payments rp
JOIN rentals r ON r.id = rp.rental_id
WHERE r.booking_no = 'REN-0004'
ORDER BY rp.payment_date;

SELECT '=== 5. Journal headers — rental / payment chain ===' AS audit_section;
SELECT
  je.id,
  je.entry_no,
  je.entry_date,
  je.reference_type,
  je.reference_id,
  je.payment_id,
  je.description,
  je.is_void,
  je.document_no
FROM journal_entries je
WHERE je.entry_no IN ('RCV-0008', 'JE-0009', 'JE-0010', 'JE-0197', 'JE-0198', 'RCV-0015')
   OR je.reference_id = '14d4c6fd-c55f-4753-96df-7d16d0319542'
   OR je.payment_id = '315c21c2-ed7b-4a3f-97d6-4ca4f3c34f44'
ORDER BY je.entry_date, je.entry_no;

SELECT '=== 6. JE lines — RCV-0008 / REN-0004 / AR-CUS0060 ===' AS audit_section;
WITH target_jes AS (
  SELECT DISTINCT je.id
  FROM journal_entries je
  LEFT JOIN payments p ON p.id = je.payment_id
    OR (je.reference_type = 'payment' AND je.reference_id = p.id)
  WHERE je.entry_no IN ('RCV-0008', 'JE-0009', 'JE-0010', 'JE-0197', 'JE-0198', 'RCV-0015')
     OR p.reference_number = 'RCV-0008'
     OR je.reference_id = '14d4c6fd-c55f-4753-96df-7d16d0319542'
  UNION
  SELECT je.id FROM journal_entries je
  JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
  JOIN accounts acc ON acc.id = jel.account_id
  WHERE acc.code = 'AR-CUS0060'
)
SELECT
  je.entry_no,
  je.entry_date,
  je.reference_type,
  je.is_void,
  acc.code AS account_code,
  acc.name AS account_name,
  lc.name AS linked_contact_name,
  jel.debit,
  jel.credit,
  jel.description AS line_description
FROM target_jes t
JOIN journal_entries je ON je.id = t.id
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN accounts acc ON acc.id = jel.account_id
LEFT JOIN contacts lc ON lc.id = acc.linked_contact_id
ORDER BY je.entry_date, je.entry_no, jel.debit DESC, jel.credit DESC;

SELECT '=== 7. AR/AP unmapped queue row for RCV-0008 ===' AS audit_section;
SELECT *
FROM v_ar_ap_unmapped_journals
WHERE entry_no = 'RCV-0008';

SELECT '=== 8. journal_party_contact_mapping ===' AS audit_section;
SELECT m.*
FROM journal_party_contact_mapping m
WHERE m.journal_entry_id IN (
  SELECT je.id FROM journal_entries je
  WHERE je.entry_no IN ('RCV-0008', 'JE-0009', 'JE-0010', 'JE-0197', 'JE-0198')
);

SELECT '=== 9. Manual JEs mentioning Saqib / REN-0004 / RCV-0008 ===' AS audit_section;
SELECT je.id, je.entry_no, je.entry_date, je.reference_type, je.description, je.is_void
FROM journal_entries je
WHERE (
  je.description ILIKE '%saqib%'
  OR je.description ILIKE '%REN-0004%'
  OR je.description ILIKE '%RCV-0008%'
  OR je.description ILIKE '%AR-CUS0060%'
)
AND je.entry_date >= '2026-01-01'
ORDER BY je.entry_date;

SELECT '=== 10. AR-CUS0060 ledger net (non-void) ===' AS audit_section;
SELECT
  acc.code,
  acc.name,
  COALESCE(SUM(jel.debit), 0) AS total_debit,
  COALESCE(SUM(jel.credit), 0) AS total_credit,
  COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0) AS net_dr_minus_cr
FROM accounts acc
JOIN journal_entry_lines jel ON jel.account_id = acc.id
JOIN journal_entries je ON je.id = jel.journal_entry_id AND COALESCE(je.is_void, false) = false
WHERE acc.code = 'AR-CUS0060'
GROUP BY acc.code, acc.name;

SELECT '=== 11. AR-CUS0060 running balance ===' AS audit_section;
SELECT
  je.entry_date,
  je.entry_no,
  je.reference_type,
  jel.debit,
  jel.credit,
  SUM(jel.debit - jel.credit) OVER (ORDER BY je.entry_date, je.entry_no) AS running_balance
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id AND COALESCE(je.is_void, false) = false
JOIN accounts acc ON acc.id = jel.account_id
WHERE acc.code = 'AR-CUS0060'
ORDER BY je.entry_date, je.entry_no;

SELECT '=== 12. Payment vs JE reference mismatch ===' AS audit_section;
SELECT
  p.reference_number AS payment_ref,
  p.reference_type AS payment_ref_type,
  p.reference_id AS payment_ref_id,
  p.contact_id AS payment_contact_id,
  p.amount,
  je.entry_no,
  je.reference_type AS je_ref_type,
  je.reference_id AS je_ref_id,
  je.description AS je_description
FROM payments p
JOIN journal_entries je ON je.payment_id = p.id
   OR (je.reference_type = 'payment' AND je.reference_id = p.id)
WHERE p.reference_number = 'RCV-0008';

SELECT '=== 13. rental_payments vs payments link (REN-0004) ===' AS audit_section;
SELECT
  rp.reference AS rental_payment_ref,
  rp.amount AS rp_amount,
  rp.journal_entry_id AS rp_je_id,
  p.reference_number AS payment_ref,
  p.reference_type AS payment_ref_type,
  p.amount AS p_amount,
  je.entry_no,
  je.reference_type AS je_ref_type
FROM rental_payments rp
JOIN rentals r ON r.id = rp.rental_id
LEFT JOIN journal_entries je ON je.id = rp.journal_entry_id
LEFT JOIN payments p ON p.id = je.payment_id
   OR (je.reference_type = 'payment' AND je.reference_id = p.id)
WHERE r.booking_no = 'REN-0004'
ORDER BY rp.payment_date;

SELECT '=== 14. developer_repair_audit (Saqib / RCV / REN) ===' AS audit_section;
SELECT id, action_id, risk_level, target_table, target_id, status, created_at,
  LEFT(before_json::text, 120) AS before_snip,
  LEFT(after_json::text, 120) AS after_snip
FROM developer_repair_audit
WHERE before_json::text ILIKE '%RCV-0008%'
   OR after_json::text ILIKE '%RCV-0008%'
   OR before_json::text ILIKE '%REN-0004%'
   OR after_json::text ILIKE '%REN-0004%'
   OR before_json::text ILIKE '%AR-CUS0060%'
   OR after_json::text ILIKE '%AR-CUS0060%'
   OR before_json::text ILIKE '%saqib%'
   OR after_json::text ILIKE '%saqib%'
ORDER BY created_at DESC
LIMIT 20;

SELECT '=== 15. correction_reversal rows ===' AS audit_section;
SELECT je.entry_no, je.reference_type, je.description, je.is_void
FROM journal_entries je
WHERE je.reference_type = 'correction_reversal'
  AND (je.description ILIKE '%saqib%' OR je.description ILIKE '%REN-0004%' OR je.description ILIKE '%RCV-0008%');

SELECT '=== 16. ar_ap_reconciliation_review_items ===' AS audit_section;
SELECT *
FROM ar_ap_reconciliation_review_items
WHERE item_key ILIKE '%RCV-0008%'
   OR item_key ILIKE '%saqib%'
   OR item_key ILIKE '%REN-0004%';
