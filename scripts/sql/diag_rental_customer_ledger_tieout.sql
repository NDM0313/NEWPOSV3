-- Rental customer ledger tie-out: REN-0002, REN-0004 (read-only)
--
-- Supabase SQL editor: run ONE section at a time.
-- VPS psql:
--   ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1" < scripts/sql/diag_rental_customer_ledger_tieout.sql

-- === 1. Rental bookings header ===
WITH co AS (
  SELECT company_id FROM sales WHERE invoice_no IN ('HQ-SL-0003','SL-0001') LIMIT 1
)
SELECT
  rb.booking_no,
  rb.status,
  rb.customer_id,
  c.name AS customer_name,
  rb.total_amount,
  rb.paid_amount,
  rb.due_amount
FROM rental_bookings rb
CROSS JOIN co
LEFT JOIN contacts c ON c.id = rb.customer_id
WHERE rb.company_id = co.company_id
  AND rb.booking_no IN ('REN-0002', 'REN-0004')
ORDER BY rb.booking_no;

-- === 2. Rental payments + linked JEs ===
WITH co AS (
  SELECT company_id FROM sales WHERE invoice_no IN ('HQ-SL-0003','SL-0001') LIMIT 1
),
bookings AS (
  SELECT id, booking_no FROM rental_bookings rb, co
  WHERE rb.company_id = co.company_id AND rb.booking_no IN ('REN-0002', 'REN-0004')
)
SELECT
  b.booking_no,
  rp.reference_number AS payment_ref,
  rp.amount,
  rp.voided_at,
  rp.payment_date,
  je.entry_no,
  je.reference_type AS je_ref_type,
  je.is_void AS je_void
FROM bookings b
JOIN rental_payments rp ON rp.rental_booking_id = b.id
LEFT JOIN journal_entries je ON je.payment_id = rp.id AND je.company_id = (SELECT company_id FROM co)
ORDER BY b.booking_no, rp.payment_date;

-- === 3. AR lines for Inayat / REN-0002 customer (if linked) ===
WITH co AS (
  SELECT company_id FROM sales WHERE invoice_no IN ('HQ-SL-0003','SL-0001') LIMIT 1
),
cust AS (
  SELECT c.id, c.name, a.id AS ar_id, a.code AS ar_code
  FROM contacts c
  CROSS JOIN co
  JOIN accounts a ON a.linked_contact_id = c.id AND a.company_id = c.company_id
  WHERE c.company_id = co.company_id AND c.name ILIKE '%inayat%'
  LIMIT 1
)
SELECT
  cust.name,
  cust.ar_code,
  je.entry_no,
  je.reference_type,
  je.description,
  ROUND(jel.debit::numeric, 2) AS debit,
  ROUND(jel.credit::numeric, 2) AS credit
FROM cust
JOIN journal_entry_lines jel ON jel.account_id = cust.ar_id
JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.company_id = (SELECT company_id FROM co)
WHERE COALESCE(je.is_void, false) = false
  AND (je.description ILIKE '%REN-0002%' OR je.description ILIKE '%REN-0004%' OR je.description ILIKE '%rental%')
ORDER BY je.entry_date;
