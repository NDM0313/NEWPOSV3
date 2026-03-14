-- Commission Report Ground Truth
-- Run in Supabase SQL Editor. Replace :company_id, :start, :end, :salesman_id, :branch_id as needed.
-- Use same filters as UI: period, branch (or all), salesman (or all), status, payment eligibility.

-- 1) Base set: final sales with invoice_date in range and (commission_amount > 0 OR salesman_id IS NOT NULL)
--    This matches the report's base criteria before payment eligibility filter.

-- Example: All salesmen, all branches, all status, INCLUDE DUE (no due_amount filter)
-- Replace 'YOUR_COMPANY_ID' with your company UUID, and dates in YYYY-MM-DD.
/*
SELECT
  s.id,
  s.invoice_no,
  s.invoice_date,
  s.salesman_id,
  s.commission_amount,
  s.commission_status,
  s.due_amount,
  s.branch_id,
  s.total,
  s.customer_name
FROM sales s
WHERE s.company_id = 'YOUR_COMPANY_ID'
  AND s.status = 'final'
  AND s.invoice_date >= '2015-12-31'
  AND s.invoice_date <= '2026-03-14'
  AND (COALESCE(s.commission_amount, 0) > 0 OR s.salesman_id IS NOT NULL)
ORDER BY s.invoice_date ASC;
*/

-- 2) Same but INCLUDE DUE + specific salesman (e.g. arslan's user id)
-- Replace :salesman_id with the user UUID for arslan (from: SELECT id, full_name FROM users WHERE full_name ILIKE '%arslan%';).
/*
SELECT
  s.id,
  s.invoice_no,
  s.invoice_date,
  s.salesman_id,
  s.commission_amount,
  s.commission_status,
  s.due_amount
FROM sales s
WHERE s.company_id = 'YOUR_COMPANY_ID'
  AND s.status = 'final'
  AND s.invoice_date >= '2015-12-31'
  AND s.invoice_date <= '2026-03-14'
  AND s.salesman_id = 'SALESMAN_USER_UUID'
  AND (COALESCE(s.commission_amount, 0) > 0 OR s.salesman_id IS NOT NULL)
ORDER BY s.invoice_date ASC;
*/

-- 3) FULLY PAID ONLY: add due_amount filter (matches report when "Fully paid only" selected)
/*
SELECT
  s.id,
  s.invoice_no,
  s.invoice_date,
  s.salesman_id,
  s.commission_amount,
  s.due_amount
FROM sales s
WHERE s.company_id = 'YOUR_COMPANY_ID'
  AND s.status = 'final'
  AND s.invoice_date >= '2015-12-31'
  AND s.invoice_date <= '2026-03-14'
  AND (s.due_amount IS NULL OR s.due_amount <= 0)
  AND (COALESCE(s.commission_amount, 0) > 0 OR s.salesman_id IS NOT NULL)
ORDER BY s.invoice_date ASC;
*/

-- 4) Get expected row count and totals (INCLUDE DUE)
-- Uses first company. End date: invoice_date::date <= end so full end day included (timestamp-safe).
SELECT
  COUNT(*) AS row_count,
  COALESCE(SUM(s.total), 0) AS total_sales,
  COALESCE(SUM(s.commission_amount), 0) AS total_commission
FROM sales s
WHERE s.company_id = (SELECT id FROM companies LIMIT 1)
  AND s.status = 'final'
  AND (s.invoice_date::date >= '2015-12-31' AND s.invoice_date::date <= '2026-03-14')
  AND (COALESCE(s.commission_amount, 0) > 0 OR s.salesman_id IS NOT NULL);

-- 5) List invoice numbers expected in report (INCLUDE DUE)
SELECT s.invoice_no, s.invoice_date, s.salesman_id, s.commission_amount, s.due_amount
FROM sales s
WHERE s.company_id = (SELECT id FROM companies LIMIT 1)
  AND s.status = 'final'
  AND (s.invoice_date::date >= '2015-12-31' AND s.invoice_date::date <= '2026-03-14')
  AND (COALESCE(s.commission_amount, 0) > 0 OR s.salesman_id IS NOT NULL)
ORDER BY s.invoice_date, s.invoice_no;
