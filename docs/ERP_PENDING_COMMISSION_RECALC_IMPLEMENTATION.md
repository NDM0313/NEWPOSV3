# ERP Pending Commission Recalculation — Implementation

## Requirement

- **New sales** continue to use the user’s default commission % (existing behavior).
- **Existing pending/unposted** sales can be updated when the user’s default commission changes.
- **Posted** sales must never change (immutable).

## Implementation

### Service: `recalculatePendingCommissions`

**File:** `src/app/services/commissionReportService.ts`

- **Params:** `companyId`, `startDate`, `endDate`, optional `branchId`, optional `salesmanId` (aligned with report filters).
- **Logic:**
  1. Select sales where:
     - `company_id`, `status = 'final'`
     - `invoice_date` in range (same end-day logic as report: `invoice_date < endExclusive`)
     - `commission_status` is null or `'pending'`
     - `commission_batch_id` IS NULL
     - optional `branch_id` / `salesman_id` when provided
  2. Load `users.default_commission_percent` for all distinct `salesman_id` in that set.
  3. For each sale whose salesman has a defined `default_commission_percent`:
     - Base = `commission_eligible_amount` or `total`
     - New `commission_amount` = base × (default_commission_percent / 100)
     - Update only: `commission_percent`, `commission_amount`
  4. Each update is guarded by `.is('commission_batch_id', null).or('commission_status.is.null,commission_status.eq.pending')` so posted rows are never changed.
- **Return:** `{ updatedCount: number }`.

### UI: Commission Report

**File:** `src/app/components/reports/CommissionReportPage.tsx`

- **Button:** “Recalculate Pending” next to “Post Commission” (outline style).
- **Behavior:** Calls `recalculatePendingCommissions` with current report filters (period, branch, salesman). On success: toast with updated count, then refetch report. Disabled when recalculating or when company/period is missing.
- **Icon:** RefreshCw; loading state shows spinner.

## Safety

- Only sales with `commission_batch_id` IS NULL and `commission_status` in (null, 'pending') are updated.
- Posted sales are excluded by the query and by the per-row update filter; they are never modified.
- Recalc uses the **current** `users.default_commission_percent`; changing the default and clicking “Recalculate Pending” updates only pending sales in the filtered range.

## Verification

1. Set a user’s `default_commission_percent` (DB or future UI).
2. Create a final sale with that salesman and save (pending commission).
3. Change the user’s default_commission_percent.
4. Open Reports → Commission, set filters (e.g. that salesman, period including the sale), click **Recalculate Pending**.
5. Confirm the pending sale’s commission % and amount match the new default; totals in the report update.
6. Post commission for that sale, then run Recalculate Pending again; the posted sale’s commission must not change.

## Rollback

- Remove the “Recalculate Pending” button and `handleRecalculatePending` from CommissionReportPage.
- Remove `recalculatePendingCommissions` and its types from commissionReportService.
