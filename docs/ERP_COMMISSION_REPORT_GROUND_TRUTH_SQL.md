# ERP Commission Report — Ground Truth SQL

## Purpose

Establish the exact set of rows that **should** appear in the Commission report for given filters, so we can compare with the service result and UI.

## Base Criteria (matches report service)

- `sales.company_id` = current company
- `sales.status` = `'final'`
- `sales.invoice_date` between period start and end (inclusive)
- Include row if `commission_amount > 0` OR `salesman_id IS NOT NULL`
- Optional: `branch_id`, `salesman_id`, `commission_status`, and payment eligibility (`due_amount`)

## Filters (aligned with UI)

| UI filter           | SQL / service behavior |
|---------------------|-------------------------|
| Period              | `invoice_date >= :start` AND `invoice_date <= :end` |
| Branch              | If specific: `branch_id = :branch_id`; All: no filter |
| Salesperson         | If specific: `salesman_id = :salesman_id`; All: no filter |
| Status              | All: no filter; Pending: `commission_status IS NULL OR = 'pending'`; Posted: `commission_status = 'posted'` |
| Payment eligibility | **Fully paid only**: `due_amount IS NULL OR due_amount <= 0`; **Include due sales**: no filter |

## Ground truth queries

Run in Supabase SQL Editor. Use your `company_id` and date range (e.g. from global filter: 2015-12-31 to 2026-03-14).

### 1) Expected row count and totals (Include due sales, all salesmen, all branches, all status)

```sql
SELECT
  COUNT(*) AS row_count,
  COALESCE(SUM(s.total), 0) AS total_sales,
  COALESCE(SUM(s.commission_amount), 0) AS total_commission
FROM sales s
WHERE s.company_id = 'YOUR_COMPANY_ID'
  AND s.status = 'final'
  AND s.invoice_date >= '2015-12-31'
  AND s.invoice_date <= '2026-03-14'
  AND (COALESCE(s.commission_amount, 0) > 0 OR s.salesman_id IS NOT NULL);
```

### 2) Exact invoice numbers expected (Include due sales)

```sql
SELECT s.invoice_no, s.invoice_date, s.salesman_id, s.commission_amount, s.due_amount
FROM sales s
WHERE s.company_id = 'YOUR_COMPANY_ID'
  AND s.status = 'final'
  AND s.invoice_date >= '2015-12-31'
  AND s.invoice_date <= '2026-03-14'
  AND (COALESCE(s.commission_amount, 0) > 0 OR s.salesman_id IS NOT NULL)
ORDER BY s.invoice_date, s.invoice_no;
```

### 3) Specific salesman (e.g. arslan) — Include due sales

Replace `SALESMAN_USER_UUID` with the user's id from `SELECT id, full_name FROM users WHERE full_name ILIKE '%arslan%';`.

```sql
SELECT s.invoice_no, s.invoice_date, s.commission_amount, s.due_amount
FROM sales s
WHERE s.company_id = 'YOUR_COMPANY_ID'
  AND s.status = 'final'
  AND s.invoice_date >= '2015-12-31'
  AND s.invoice_date <= '2026-03-14'
  AND s.salesman_id = 'SALESMAN_USER_UUID'
  AND (COALESCE(s.commission_amount, 0) > 0 OR s.salesman_id IS NOT NULL)
ORDER BY s.invoice_date;
```

### 4) Fully paid only (same as UI when "Fully paid only" selected)

```sql
SELECT s.invoice_no, s.invoice_date, s.commission_amount, s.due_amount
FROM sales s
WHERE s.company_id = 'YOUR_COMPANY_ID'
  AND s.status = 'final'
  AND s.invoice_date >= '2015-12-31'
  AND s.invoice_date <= '2026-03-14'
  AND (s.due_amount IS NULL OR s.due_amount <= 0)
  AND (COALESCE(s.commission_amount, 0) > 0 OR s.salesman_id IS NOT NULL)
ORDER BY s.invoice_date;
```

## How to use

1. Run query (1) and (2) with your company ID and date range. Note **row_count** and **invoice_no** list.
2. In the app: set **Payment eligibility** to **Include due sales**, **Salesperson** to **All salesmen**, **Branch** to **All branches**, **Status** to **All**.
3. Compare: report row count and invoice list should match the SQL result.
4. If SQL returns rows but the report is empty, the bug is in the service or UI (see SERVICE_TRACE and UI_STATE_TRACE).
5. If "Fully paid only" returns 0 in SQL and 0 in UI, that is correct when all commission sales have a balance due; use **Include due sales** to see them.

## Reference SQL file

Runnable statements are also in `docs/commission_report_ground_truth.sql` (with placeholder company id; replace before running).
