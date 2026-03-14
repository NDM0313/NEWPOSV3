# ERP Commission Report Empty — Fix (Issue 1)

## Observed behavior
New sale with salesman/commission created, but Reports → Commission shows zero / blank.

## Root cause
1. **Date column mismatch**: The commission report and posting use `invoice_date` for the date range filter. Some databases have only `sale_date` on `sales` (e.g. base schema). If `invoice_date` is missing, the Supabase query fails or returns no rows, so the report appears empty.
2. **Backfill**: Even when `invoice_date` exists, older rows might have it null if they were inserted when only `sale_date` was set.

## Fix

### 1. Migration: ensure `invoice_date` exists and is populated
**File**: `migrations/sales_ensure_invoice_date_for_commission.sql`

- If `sales.invoice_date` does not exist: add column, backfill from `sale_date` (then `created_at::date`, then `CURRENT_DATE`), create index.
- If both columns exist: backfill `invoice_date` from `sale_date` where `invoice_date` is null.

Run this migration on the local DB so the commission report query (`.gte('invoice_date', start).lte('invoice_date', end)`) returns rows.

### 2. Report query (no code change to filter logic)
The report already:
- Filters by `company_id`, `status = 'final'`, date range on `invoice_date`.
- Includes rows where `(commission_amount > 0 OR salesman_id != null)` (so salesman-assigned sales with 0 commission still appear).
- Optionally filters by branch and salesman; **Payment eligibility** (Fully paid only / Include due) applied in this fix pass.

No change was needed to the “include salesman rows” logic; the blocker was the date column.

### 3. Verification
- Run the migration.
- Create a **final** sale with a salesman and commission (or at least salesman).
- Open Reports → Commission; set date range to include the sale date; leave branch/salesman as “All” if applicable.
- Report should list the sale and show totals.

## Files changed
- **Added**: `migrations/sales_ensure_invoice_date_for_commission.sql`
- **Updated**: `src/app/services/commissionReportService.ts` — added `paymentEligibility` and optional `due_amount`/`payment_status` in select for future use; payment filter applied when “Fully paid only” is selected.

## Summary
The empty report was caused by the report (and batch posting) relying on `invoice_date` while the table might only have had `sale_date` or null `invoice_date`. The migration ensures `invoice_date` exists and is backfilled so the commission report and “Post Commission” work as intended.
