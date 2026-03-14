# Dashboard Executive Summary – Data Source and Filtering Fix

**Date:** 2026-03-14  
**Scope:** Local ERP; Executive Summary shows correct, current data.

---

## Issue

Executive Summary on the Dashboard appeared to show wrong, stale, or old data. Possible causes included:

- Preferring “non-zero” RPC metrics and falling back to context-based metrics when RPC returned all zeros (e.g. no sales in the selected range), which then showed “today” and “this month” instead of the selected range.
- Fallback metrics were computed for a fixed “today” and “this month” instead of the **global date range**.
- Mix of RPC vs context logic could make the summary out of sync with the selected period and current company/branch.

---

## Requirement

- Executive Summary should reflect **actual current ERP data**.
- Use **current company**, **current branch**, and **current global date range**.
- When RPC succeeds, use it (even if values are zero for the selected range).
- When RPC fails, fallback should use the **same global date range**, not fixed today/month.

---

## Root cause

1. **Display logic:** `displayMetrics` was set to `financialMetrics` only when `hasNonZeroMetrics` was true. So when `get_dashboard_metrics` returned a valid payload with all zeros (e.g. “Last 7 Days” with no sales), the UI fell back to `executiveFromContext`, which was computed for “today” and “this month” only. That made the summary look wrong for the selected range.
2. **Fallback range:** `executiveFromContext` used fixed `todayStr`, `monthStartStr`, `monthEndStr`, so it never reflected the user’s chosen date range (e.g. Last 30 Days, Custom Range).

---

## Changes

1. **Prefer RPC whenever available**
   - Removed `hasNonZeroMetrics`.
   - `displayMetrics = financialMetrics ?? executiveFromContext`.
   - So whenever `get_dashboard_metrics` returns a result (even all zeros), that result is shown. Fallback is only when RPC fails or returns null.

2. **Fallback uses global date range**
   - `executiveFromContext` now uses `startDate` and `endDate` from `useGlobalFilter()` (as `periodStart` / `periodEnd`).
   - Period sales, expenses, and profit are computed by filtering sales/purchases/expenses to dates within that range.
   - Trend arrays (e.g. last 7 days) are built over the selected range (or last 7 days if no range). So when RPC fails, the fallback still matches the user’s period.

3. **Cash/Bank in fallback**
   - `displayMetricsWithCashBank` no longer references `hasNonZeroMetrics`. It still merges in accounting cash/bank balances when RPC did not provide them.

---

## Data flow (unchanged, confirmed)

- Dashboard calls `getDashboardMetrics(companyId, branchId, start, end)` with:
  - `companyId` from Supabase context
  - `branchId` from global filter (or null for all)
  - `start` / `end` from global filter
- So the RPC already receives the current company, branch, and date range. The fix ensures we **always use that RPC result when we have it**, and that the **fallback is range-aware**.

---

## Files changed

- `src/app/components/dashboard/Dashboard.tsx`:
  - Use `financialMetrics ?? executiveFromContext` for `displayMetrics`.
  - Remove `hasNonZeroMetrics`; update `displayMetricsWithCashBank` to depend only on `financialMetrics` and `displayMetrics`.
  - Rework `executiveFromContext` to use `periodStart`/`periodEnd` from global `startDate`/`endDate` and compute period totals and trends over that range.

---

## Rollback

Revert the Dashboard.tsx changes. Restore `hasNonZeroMetrics` and the previous `executiveFromContext` (today + month). Executive Summary may again show “today/month” when the selected range has no data.
