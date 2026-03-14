# ERP Commission Report — Service Layer Trace

## Flow

1. **CommissionReportPage** calls `getCommissionReport(companyId, startDate, endDate, options)` with:
   - `options.branchId`: from `effectiveBranchId` (prop or local branch or global), only if not `'all'`
   - `options.salesmanId`: from `salesmanFilterId` (null = All salesmen)
   - `options.status`: `'all'` | `'pending'` | `'posted'`
   - `options.paymentEligibility`: `'include_due'` (default) | `'fully_paid_only'`

2. **commissionReportService.getCommissionReport**:
   - Normalizes dates: `start = startDate.slice(0, 10)`, `end = endDate.slice(0, 10)` (YYYY-MM-DD).
   - Builds Supabase query on `sales`: `company_id`, `status = 'final'`, `invoice_date` in range, then optional `branch_id`, `salesman_id`, `commission_status`, and for `fully_paid_only`: `.or('due_amount.lte.0,due_amount.is.null')`.
   - Selects: id, invoice_no, invoice_date, salesman_id, commission_amount, commission_eligible_amount, commission_percent, commission_status, commission_batch_id, total, customer_name, branch_id, branch:branches(id,name).
   - Fetches users for salesman names: `users` where `id IN (salesman_ids from rows)`.
   - Post-filters rows: keep only where `commission_amount > 0` OR `salesman_id != null`.
   - Groups by salesman, computes totals, returns `{ summary, period_start, period_end, totals }`.

## Comparison with SQL ground truth

- **Same filters** (period, branch, salesman, status, payment eligibility) must yield the same set of rows.
- If SQL returns N rows and service returns 0: check (1) companyId/start/end format, (2) RLS on `sales`/`users`, (3) that `salesman_id` in DB is the same as `users.id` (not auth_user_id), (4) that `due_amount` column exists and filter is correct.

## Debug logging (DEV)

When the report returns no rows, the service logs to console (dev only):

- `companyId`, `start`, `end`, `branchId`, `salesmanId`, `statusFilter`, `paymentEligibility`
- If `paymentEligibility === 'fully_paid_only'`, a hint: *Try "Include due sales" if sales have balance due.*

Use this to confirm the options passed from the UI match what you expect.

## Known cause of “blank” report

- **Default was "Fully paid only"**: any sale with `due_amount > 0` was excluded, so commission sales with balance due (e.g. SL-0044) did not appear.
- **Fix**: Default is now **Include due sales**; "Fully paid only" remains available and correctly filters to `due_amount <= 0 or null`.
- If the UI still shows empty with **Include due sales**, compare with ground truth SQL (same company, dates, all salesmen, all branches) and check the dev console for the logged options and any Supabase error.
