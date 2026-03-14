# ERP Commission Report — Query/Filter Fix

## Summary

The commission report was blank even though valid final sales with salesman and commission data existed in the database. The root cause was the **default payment eligibility filter** excluding all sales that had a balance due.

## Root Cause

- **Filter in question**: `paymentEligibility === 'fully_paid_only'` applied this Supabase filter:
  - `query.or('due_amount.lte.0,due_amount.is.null')`
- **Default value**: Both the page and the service used **`'fully_paid_only'`** as the default.
- **Effect**: Any sale with `due_amount > 0` (e.g. partial payment, unpaid) was excluded. Sales like SL-0044 (Amount Due Rs. 17,000) and SL-0043 were therefore hidden, so the report showed no rows even when commission data existed.

The query itself was correct:
- Uses `sales.invoice_date` for the date range (not `sale_date`).
- Uses `status = 'final'`.
- Uses `salesman_id` and `commission_amount`; post-query filter keeps rows with `commission_amount > 0` or `salesman_id != null`.
- Salesman names are resolved from `users` by `salesman_id` (users.id).

The only behavioral fix required was to **default to showing all commission-eligible sales** and let users narrow to “Fully paid only” when needed.

## Files Changed

| File | Change |
|------|--------|
| `src/app/components/reports/CommissionReportPage.tsx` | Default state for `paymentEligibility` changed from `'fully_paid_only'` to `'include_due'`. |
| `src/app/services/commissionReportService.ts` | Default in `getCommissionReport` for `paymentEligibility` changed from `'fully_paid_only'` to `'include_due'`; comment updated. |

## Query/Filter Verification

- **Date range**: From global report period; applied as `invoice_date >= start` and `invoice_date <= end`. Correct.
- **Branch**: Optional `branch_id` when not “All branches”. Correct.
- **Salesman**: Optional `salesman_id` when a specific salesman is selected. Correct.
- **Status**: `pending` / `posted` / `all` applied to `commission_status`. Correct.
- **Payment eligibility**:
  - **Fully paid only**: `due_amount <= 0 OR due_amount IS NULL` — only fully paid (or null) sales.
  - **Include due sales**: No extra filter — all commission-eligible sales in the period appear.

## Proof That Existing Rows Now Appear

- With default **Include due sales**:
  - Sales such as SL-0044 and SL-0043 (with `salesman_id`, `commission_amount`, `commission_status = 'pending'`, `invoice_date`, `status = 'final'`) are included even if they have `due_amount > 0`.
- With **Fully paid only** selected:
  - Only sales with `due_amount <= 0` or `due_amount` null are shown; partial/unpaid sales are correctly excluded.

## Verification Steps

1. Open Reports → Commission Report.
2. Set period (e.g. “From start” or a range that includes your test invoices).
3. Leave **Payment eligibility** on **Include due sales** (default).
4. Confirm rows appear for final sales with salesman/commission (e.g. SL-0044, SL-0043).
5. Switch to **Fully paid only** and confirm only fully paid (or null due) commission sales remain.
6. Switch back to **Include due sales** and confirm partial/unpaid commission sales reappear.

## Rollback

To revert to the previous default (report showing only fully paid by default):

- In `CommissionReportPage.tsx`: set initial state back to `'fully_paid_only'`.
- In `commissionReportService.ts`: set default back to `options?.paymentEligibility ?? 'fully_paid_only'` and restore the previous comment.

No database or API contract changes were made; rollback is limited to these two files.
