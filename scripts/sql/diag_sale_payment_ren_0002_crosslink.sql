-- Diagnose sale payment history vs Roznamcha mismatch:
-- HQ-RCV-0006, HQ-RCV-0003, REN-0002-PAY
-- Safe: SELECT only.
-- Run: ssh dincouture-vps "cd /root/NEWPOSV3 && docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1" < scripts/sql/diag_sale_payment_ren_0002_crosslink.sql

\echo '=== A. payments (HQ-RCV-0006, HQ-RCV-0003, REN-0002-PAY) ==='
SELECT
  p.id,
  p.reference_number,
  p.payment_date,
  p.amount,
  p.payment_type,
  p.reference_type,
  p.reference_id,
  p.contact_id,
  p.branch_id,
  p.payment_account_id,
  a.code AS account_code,
  a.name AS account_name,
  p.voided_at,
  je.id AS journal_entry_id,
  je.entry_no,
  je.reference_type AS je_reference_type,
  je.is_void AS je_is_void
FROM payments p
LEFT JOIN accounts a ON a.id = p.payment_account_id
LEFT JOIN journal_entries je ON je.payment_id = p.id
WHERE p.reference_number IN ('HQ-RCV-0006', 'HQ-RCV-0003')
   OR p.reference_number ILIKE 'REN-0002-PAY'
   OR p.reference_number ILIKE 'REN-0002%'
ORDER BY p.payment_date DESC, p.reference_number;

\echo '=== B. rental_payments for booking REN-0002 ==='
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
  je.entry_date AS je_entry_date,
  je.is_void AS je_is_void
FROM rental_payments rp
JOIN rentals r ON r.id = rp.rental_id
LEFT JOIN accounts a ON a.id = rp.payment_account_id
LEFT JOIN journal_entries je ON je.id = rp.journal_entry_id
WHERE r.booking_no = 'REN-0002'
ORDER BY rp.payment_date DESC;

\echo '=== C. payment_allocations linked to HQ-RCV sale payments ==='
SELECT
  pa.id AS allocation_id,
  pa.sale_id,
  pa.payment_id,
  pa.allocated_amount,
  pa.allocation_date,
  pa.allocation_order,
  p.reference_number,
  p.reference_type,
  p.reference_id,
  p.amount AS parent_payment_amount,
  p.voided_at AS parent_voided_at,
  s.invoice_no,
  s.order_no,
  s.total AS sale_total,
  s.paid_amount AS sale_paid,
  s.due_amount AS sale_due
FROM payment_allocations pa
JOIN payments p ON p.id = pa.payment_id
JOIN sales s ON s.id = pa.sale_id
WHERE p.reference_number IN ('HQ-RCV-0006', 'HQ-RCV-0003')
   OR p.reference_number ILIKE 'REN-0002-PAY'
   OR pa.sale_id IN (
     SELECT p2.reference_id
     FROM payments p2
     WHERE p2.reference_type = 'sale'
       AND p2.reference_number IN ('HQ-RCV-0006', 'HQ-RCV-0003')
   )
ORDER BY pa.allocation_date DESC, pa.allocation_order;

\echo '=== D. sales directly linked via payments.reference_type=sale ==='
SELECT
  p.id AS payment_id,
  p.reference_number,
  p.payment_date,
  p.amount,
  p.reference_type,
  s.id AS sale_id,
  s.invoice_no,
  s.order_no,
  s.total,
  s.paid_amount,
  s.due_amount,
  s.status
FROM payments p
JOIN sales s ON s.id = p.reference_id
WHERE p.reference_type = 'sale'
  AND p.reference_number IN ('HQ-RCV-0006', 'HQ-RCV-0003')
  AND p.voided_at IS NULL
ORDER BY p.payment_date DESC;

\echo '=== E. journal_entries for linked payments / rental ==='
SELECT
  je.id,
  je.entry_no,
  je.entry_date,
  je.payment_id,
  je.reference_type,
  je.reference_id,
  je.is_void,
  je.branch_id,
  je.description
FROM journal_entries je
WHERE je.payment_id IN (
  SELECT p.id FROM payments p
  WHERE p.reference_number IN ('HQ-RCV-0006', 'HQ-RCV-0003')
     OR p.reference_number ILIKE 'REN-0002-PAY'
)
   OR je.id IN (
     SELECT rp.journal_entry_id FROM rental_payments rp
     JOIN rentals r ON r.id = rp.rental_id
     WHERE r.booking_no = 'REN-0002'
   )
ORDER BY je.entry_date DESC, je.entry_no;

\echo '=== F. cash Dr lines on target JEs ==='
SELECT
  je.entry_no,
  jel.debit,
  jel.credit,
  a.code,
  a.name,
  a.type
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN accounts a ON a.id = jel.account_id
WHERE je.payment_id IN (
  SELECT p.id FROM payments p
  WHERE p.reference_number IN ('HQ-RCV-0006', 'HQ-RCV-0003')
     OR p.reference_number ILIKE 'REN-0002-PAY'
)
   OR je.id IN (
     SELECT rp.journal_entry_id FROM rental_payments rp
     JOIN rentals r ON r.id = rp.rental_id
     WHERE r.booking_no = 'REN-0002'
   )
ORDER BY je.entry_no, jel.debit DESC;

\echo '=== G. REN-0002 rental paid vs active rental_payments sum ==='
SELECT
  r.booking_no,
  r.total_amount,
  r.paid_amount,
  r.due_amount,
  (
    SELECT COALESCE(SUM(rp.amount), 0)
    FROM rental_payments rp
    WHERE rp.rental_id = r.id AND rp.voided_at IS NULL
  ) AS active_payments_sum
FROM rentals r
WHERE r.booking_no = 'REN-0002';
