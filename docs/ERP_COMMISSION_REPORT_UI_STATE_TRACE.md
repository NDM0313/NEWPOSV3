# ERP Commission Report — UI State / Filter Wiring Trace

## State and props

| Source | Variable | Passed to service as |
|--------|----------|----------------------|
| Props | `startDate`, `endDate` | From parent: `reportStartDate`, `reportEndDate` (from global filter; ISO date strings). |
| Props | `branchId: propBranchId` | From parent: `branchId === 'all' ? null : branchId`. |
| useSupabase | `branchId: globalBranchId` | Used in `effectiveBranchId` when prop is null. |
| Local state | `salesmanFilterId` | `salesmanId`: null → All; else the selected user id. |
| Local state | `branchFilterId` | Part of `effectiveBranchId` when prop is null. |
| Local state | `statusFilter` | `status`: 'all' | 'pending' | 'posted'. |
| Local state | `paymentEligibility` | `paymentEligibility`: 'include_due' (default) | 'fully_paid_only'. |

## effectiveBranchId

`effectiveBranchId = propBranchId ?? branchFilterId ?? globalBranchId`.

- Passed to service as: `branchId: effectiveBranchId && effectiveBranchId !== 'all' ? effectiveBranchId : undefined`.
- So when "All branches" (prop or local or global = 'all'), the service gets `undefined` and does not filter by branch.

## Salesperson dropdown

- **When there is data** (`hasData`): options from `data.summary` (value = `row.salesman_id`).
- **When there is no data**: options from `salesmenList` from `userService.getSalesmen(companyId)` (value = `s.id`, i.e. `users.id`).
- Selecting a salesman sets `salesmanFilterId` to that id; the service filters with `.eq('salesman_id', salesmanIdFilter)`.
- `sales.salesman_id` must equal `users.id` (same as in Sale form and View Sale drawer). No string vs UUID mismatch if both are UUIDs.

## useEffect dependency and refetch

Report is fetched when: `companyId`, `startDate`, `endDate`, `effectiveBranchId`, `salesmanFilterId`, `statusFilter`, `paymentEligibility` change. So changing Payment eligibility or Salesperson triggers a new fetch with the new values.

## What to check if report is empty

1. **Payment eligibility** = "Fully paid only" → Expect zero rows if all commission sales have balance due. Switch to **Include due sales** or confirm in SQL (ground truth doc).
2. **Salesperson** = specific user → Ensure that user has final sales with salesman_id = that user id and commission in the period.
3. **Branch** = specific branch → Only sales in that branch are included; global or local branch filter might be set.
4. **Period** → From global date filter; ensure range includes your test invoices (e.g. "From start" = ~10 years to today).
5. **Stale state** → Filters are in dependency array; changing any filter refetches. If you still see old data, hard refresh or check for a second setState clearing data (none in current code).

## Defaults (after fix)

- **Payment eligibility**: `'include_due'` so the report shows all commission-eligible sales by default.
- **Salesperson**: null (All salesmen).
- **Status**: 'all'.
- **Branch**: from prop or global (can be "All" → undefined in service).
