-- Roznamcha Trace read-only review: HQ-RCV-0001 / HQ-RCV-0005
-- Safe: SELECT only. No mutations.
-- Run: ssh dincouture-vps "cd /root/NEWPOSV3 && docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1" < deploy/roznamcha-trace-hq-rcv-0001-0005-readonly.sql

\echo '=== A. payments (HQ-RCV-0001, HQ-RCV-0005, JE-0010, JE-0008) ==='
SELECT
  p.id,
  p.reference_number,
  p.payment_date,
  p.amount,
  p.payment_account_id,
  a.code AS account_code,
  a.name AS account_name,
  p.reference_type,
  p.reference_id,
  p.branch_id,
  p.voided_at,
  je.id AS journal_entry_id,
  je.entry_no,
  je.entry_date AS je_entry_date,
  je.payment_id AS je_payment_id_backlink,
  je.is_void
FROM payments p
LEFT JOIN accounts a ON a.id = p.payment_account_id
LEFT JOIN journal_entries je ON je.payment_id = p.id
WHERE p.reference_number IN ('HQ-RCV-0001', 'HQ-RCV-0005')
   OR je.entry_no IN ('JE-0010', 'JE-0008')
ORDER BY p.reference_number, p.payment_date;

\echo '=== B. rental_payments ==='
SELECT
  rp.id,
  rp.reference,
  rp.payment_date,
  rp.amount,
  rp.payment_account_id,
  a.code AS account_code,
  a.name AS account_name,
  rp.journal_entry_id,
  rp.voided_at,
  r.id AS rental_id,
  r.booking_no,
  r.customer_name,
  r.branch_id,
  je.entry_no,
  je.entry_date AS je_entry_date
FROM rental_payments rp
JOIN rentals r ON r.id = rp.rental_id
LEFT JOIN accounts a ON a.id = rp.payment_account_id
LEFT JOIN journal_entries je ON je.id = rp.journal_entry_id
WHERE rp.reference IN ('HQ-RCV-0001', 'HQ-RCV-0005')
   OR je.entry_no IN ('JE-0010', 'JE-0008')
ORDER BY rp.reference, rp.payment_date;

\echo '=== C. journal_entries (linked) ==='
SELECT
  je.id,
  je.entry_no,
  je.entry_date,
  je.payment_id,
  je.reference_type,
  je.reference_id,
  je.is_void,
  je.branch_id,
  je.description,
  je.action_fingerprint
FROM journal_entries je
WHERE je.entry_no IN ('JE-0010', 'JE-0008')
   OR je.id IN (
     SELECT rp.journal_entry_id FROM rental_payments rp
     WHERE rp.reference IN ('HQ-RCV-0001', 'HQ-RCV-0005')
   )
   OR je.payment_id IN (
     SELECT p.id FROM payments p
     WHERE p.reference_number IN ('HQ-RCV-0001', 'HQ-RCV-0005')
   )
ORDER BY je.entry_no;

\echo '=== D. journal_entry_lines + JE balance ==='
WITH target_jes AS (
  SELECT je.id, je.entry_no
  FROM journal_entries je
  WHERE je.entry_no IN ('JE-0010', 'JE-0008')
)
SELECT
  tj.entry_no,
  jel.journal_entry_id,
  jel.debit,
  jel.credit,
  a.code,
  a.name,
  a.type,
  jel.description
FROM target_jes tj
JOIN journal_entry_lines jel ON jel.journal_entry_id = tj.id
JOIN accounts a ON a.id = jel.account_id
ORDER BY tj.entry_no, jel.debit DESC, a.code;

\echo '=== D2. JE balance check (debit = credit) ==='
WITH target_jes AS (
  SELECT je.id, je.entry_no
  FROM journal_entries je
  WHERE je.entry_no IN ('JE-0010', 'JE-0008')
)
SELECT
  tj.entry_no,
  COALESCE(SUM(jel.debit), 0) AS total_debit,
  COALESCE(SUM(jel.credit), 0) AS total_credit,
  COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0) AS imbalance,
  COUNT(*) FILTER (
    WHERE a.type IN ('cash', 'bank', 'wallet') AND jel.debit > 0
  ) AS liquidity_debit_lines,
  COALESCE(SUM(jel.debit) FILTER (
    WHERE a.type IN ('cash', 'bank', 'wallet') AND jel.debit > 0
  ), 0) AS liquidity_debit_total
FROM target_jes tj
JOIN journal_entry_lines jel ON jel.journal_entry_id = tj.id
JOIN accounts a ON a.id = jel.account_id
GROUP BY tj.entry_no
ORDER BY tj.entry_no;

\echo '=== E. match-key check (rental_id|payment_date|amount|payment_account_id) ==='
WITH pay AS (
  SELECT
    p.id AS payment_id,
    p.reference_number,
    p.reference_id AS rental_id,
    p.payment_date,
    p.amount,
    p.payment_account_id,
    CONCAT(
      p.reference_id, '|',
      p.payment_date::text, '|',
      ROUND(p.amount * 100)::text, '|',
      COALESCE(p.payment_account_id::text, '')
    ) AS match_key
  FROM payments p
  WHERE p.reference_type = 'rental'
    AND (
      p.reference_number IN ('HQ-RCV-0001', 'HQ-RCV-0005')
      OR p.reference_id IN (
        SELECT DISTINCT r.id FROM rental_payments rp
        JOIN rentals r ON r.id = rp.rental_id
        WHERE rp.reference IN ('HQ-RCV-0001', 'HQ-RCV-0005')
      )
    )
),
rp AS (
  SELECT
    rp.id AS rental_payment_id,
    rp.reference,
    rp.rental_id,
    rp.payment_date,
    rp.amount,
    rp.payment_account_id,
    rp.journal_entry_id,
    CONCAT(
      rp.rental_id, '|',
      rp.payment_date::text, '|',
      ROUND(rp.amount * 100)::text, '|',
      COALESCE(rp.payment_account_id::text, '')
    ) AS match_key
  FROM rental_payments rp
  WHERE rp.reference IN ('HQ-RCV-0001', 'HQ-RCV-0005')
)
SELECT
  rp.reference,
  rp.rental_payment_id,
  rp.payment_date AS rp_payment_date,
  pay.payment_date AS pay_payment_date,
  rp.amount AS rp_amount,
  pay.amount AS pay_amount,
  rp.match_key AS rp_match_key,
  pay.match_key AS pay_match_key,
  (rp.match_key = pay.match_key) AS match_keys_equal,
  rp.journal_entry_id,
  pay.payment_id
FROM rp
LEFT JOIN pay ON pay.reference_number = rp.reference
ORDER BY rp.reference;

\echo '=== F. double-count probe (rows per journal_entry_id) ==='
WITH linked AS (
  SELECT DISTINCT je.id AS journal_entry_id, je.entry_no
  FROM journal_entries je
  WHERE je.entry_no IN ('JE-0010', 'JE-0008')
)
SELECT
  l.entry_no,
  l.journal_entry_id,
  (SELECT COUNT(*) FROM payments p
   JOIN journal_entries je ON je.payment_id = p.id
   WHERE je.id = l.journal_entry_id) AS payment_rows_via_je,
  (SELECT COUNT(*) FROM payments p
   WHERE p.reference_number IN ('HQ-RCV-0001', 'HQ-RCV-0005')
     AND EXISTS (
       SELECT 1 FROM journal_entries je
       WHERE je.id = l.journal_entry_id AND je.payment_id = p.id
     )) AS payment_ref_rows,
  (SELECT COUNT(*) FROM rental_payments rp
   WHERE rp.journal_entry_id = l.journal_entry_id
     AND rp.voided_at IS NULL) AS rental_payment_rows,
  (SELECT COUNT(*) FROM rental_payments rp
   WHERE rp.reference IN ('HQ-RCV-0001', 'HQ-RCV-0005')
     AND rp.journal_entry_id = l.journal_entry_id) AS rental_ref_rows
FROM linked l
ORDER BY l.entry_no;

\echo '=== G. shared JE link (payment vs rental same uuid) ==='
SELECT
  rp.reference AS rp_ref,
  rp.id AS rental_payment_id,
  rp.journal_entry_id AS rp_je_id,
  p.reference_number AS pay_ref,
  p.id AS payment_id,
  je.id AS je_id,
  je.entry_no,
  (rp.journal_entry_id = je.id) AS rp_links_same_je,
  (je.payment_id = p.id) AS je_links_payment
FROM rental_payments rp
JOIN rentals r ON r.id = rp.rental_id
LEFT JOIN journal_entries je ON je.id = rp.journal_entry_id
LEFT JOIN payments p ON p.id = je.payment_id
WHERE rp.reference IN ('HQ-RCV-0001', 'HQ-RCV-0005')
ORDER BY rp.reference;
