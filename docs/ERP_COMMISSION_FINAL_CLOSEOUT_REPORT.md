# ERP Commission — Final Business Rules Fix (Closeout Report)

## Root cause of empty report
1. **Date column**: The commission report (and batch posting) filter by `invoice_date`. In some schemas, `sales` only had `sale_date`, or `invoice_date` was null for older rows. Queries using `invoice_date` then returned no rows or failed, so the report looked empty.
2. **Fix**: Migration `sales_ensure_invoice_date_for_commission.sql` ensures `sales.invoice_date` exists and is backfilled from `sale_date` (or `created_at` / current date). After running it, the report and “Post Commission” see the correct date range.

## Files changed

| File | Change |
|------|--------|
| **migrations/sales_ensure_invoice_date_for_commission.sql** | New. Adds/backfills `sales.invoice_date` for report and posting. |
| **src/app/services/commissionReportService.ts** | `PaymentEligibilityFilter` and option `paymentEligibility`; report and `postCommissionBatch` filter by fully paid when `fully_paid_only`. Update in `postCommissionBatch` restricted to rows still pending (no repost). |
| **src/app/components/reports/CommissionReportPage.tsx** | Payment eligibility dropdown (Fully paid only / Include due); state and pass-through to report and post. |
| **src/app/components/sales/ViewSaleDetailsDrawer.tsx** | “Salesman & Commission” section: resolve and show salesman name, commission %, amount, status. |

## Migration
- **migrations/sales_ensure_invoice_date_for_commission.sql** — run locally (e.g. Supabase SQL editor). No new columns for commission batch; existing batch migration remains required for `commission_status` / `commission_batch_id` / `commission_batches` if not already applied.

## How sale detail shows salesman info
- In **ViewSaleDetailsDrawer**, when the sale has `salesmanId` or commission amount &gt; 0, a “Salesman & Commission” block is shown.
- Salesman **name** is loaded from `users` by `salesmanId` (id).
- **Commission %**, **Commission amount**, and **Commission status** (Pending/Posted) come from the sale object (from API/context). Layout matches existing Transaction Details / Status Cards.

## How repost prevention works
- **Selection**: Only sales with `commission_status` null or `'pending'` and `commission_amount > 0` are selected for posting.
- **Update**: The update that sets `commission_status = 'posted'` and `commission_batch_id` is applied with `.in('id', saleIds).or('commission_status.is.null,commission_status.eq.pending')`, so rows that are already `'posted'` are never updated.
- Result: the same sale cannot be posted twice; a second run only sees and posts other pending sales.

## How payment eligibility modes work
- **Fully paid only** (default): Report and “Post Commission” restrict to sales with `due_amount <= 0` or `due_amount` null. Only these appear in the report and can be posted.
- **Include due sales**: No due filter; all sales matching the other filters (date, branch, salesman, status) are included in the report and in “Post Commission” (if pending).

Admin chooses the mode in the Commission report; the same choice applies to both the list and the “Post Commission” action.

## Verification steps
- See **docs/ERP_COMMISSION_FINAL_VERIFICATION.md** (Cases A–G): sale in report, salesman in sale detail, pending post, no repost, fully-paid-only vs include-due, and mixed filters.

## Rollback notes
- **Migration**: Reverting the invoice_date migration would require dropping the column and possibly restoring date logic to `sale_date` everywhere; not recommended if reports already depend on `invoice_date`. Prefer leaving the migration in place.
- **Code**: To revert payment eligibility, remove `paymentEligibility` from options/params and the report filter and post filter, and remove the UI dropdown.
- **Sale detail**: Remove the “Salesman & Commission” block and `salesmanName` state/effect in `ViewSaleDetailsDrawer.tsx` to revert that UI.
- **Repost safeguard**: Removing the `.or('commission_status.is.null,commission_status.eq.pending')` from the update in `postCommissionBatch` would allow overwriting already-posted sales; keep it for safety.
