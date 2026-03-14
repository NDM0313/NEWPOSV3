# ERP Commission — Payment Eligibility Rule (Issue 4)

## Requirement
Commission report and “Post Commission” support two modes:

1. **Fully paid only**  
   Only sales with due balance = 0 (fully paid) are eligible.

2. **Include due sales**  
   Sales with remaining due balance are also eligible.

## Implementation

### 1. Type and options
**File**: `src/app/services/commissionReportService.ts`

- `PaymentEligibilityFilter`: `'fully_paid_only' | 'include_due'`.
- `GetCommissionReportOptions.paymentEligibility`: optional; default `'fully_paid_only'`.
- `PostCommissionBatchParams.paymentEligibility`: optional; default `'fully_paid_only'`.

### 2. Report query
In `getCommissionReport()`:

- When `paymentEligibility === 'fully_paid_only'`:
  - Add filter: `.or('due_amount.lte.0,due_amount.is.null')`
  - So only sales with no positive balance due (or null) are included.
- When `paymentEligibility === 'include_due'`:
  - No extra filter; all sales matching other filters (date, branch, salesman, status) are included.

### 3. Post Commission
In `postCommissionBatch()`:

- Same rule: when `paymentEligibility === 'fully_paid_only'` (default), add:
  - `.or('due_amount.lte.0,due_amount.is.null')`
  to the query that fetches pending sales.
- When `paymentEligibility === 'include_due'`, no due filter; all pending commission in the selected filters is posted.

### 4. UI
**File**: `src/app/components/reports/CommissionReportPage.tsx`

- New filter: **Payment eligibility**:
  - **Fully paid only** (default)
  - **Include due sales**
- Stored in state `paymentEligibility` and passed to:
  - `getCommissionReport(..., { ..., paymentEligibility })`
  - `postCommissionBatch({ ..., paymentEligibility })`
- So both the visible report rows and the “Post Commission” action use the same mode.

## Default
Default is **Fully paid only** so that only fully paid sales are eligible unless the admin explicitly chooses “Include due sales”.

## Files changed
- `src/app/services/commissionReportService.ts`: `PaymentEligibilityFilter`, options and params, report and post filters.
- `src/app/components/reports/CommissionReportPage.tsx`: state, dropdown, and passing `paymentEligibility` into report and post.

## Summary
Payment eligibility is a single control that applies to both the commission report and to “Post Commission”: “Fully paid only” restricts to sales with no (or null) balance due; “Include due sales” allows sales with remaining due. Default is “Fully paid only”.
