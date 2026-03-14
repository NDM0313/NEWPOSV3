# ERP Commission Report — Render / Empty State Fix

## How “has data” is determined

```ts
const hasData = data && data.summary.length > 0;
```

- **Empty state** is shown when `!hasData` (no data or `data.summary` is empty).
- **Totals cards and table** are shown when `hasData`.

So if the service returns `{ summary: [], totals: { ... } }`, the UI correctly shows the empty state. The only way to get a blank report when the service has rows is if (1) `data` is null/undefined, or (2) `data.summary` is empty even though the service returned rows. In the current code, `setData` is only called with the full result of `getCommissionReport`, and that result’s `summary` is built from the same rows that populate the table; there is no separate path that clears or overwrites `summary`. So **if the service returns rows, `data.summary.length > 0` and the report renders**.

## Fixes applied

1. **Empty state copy when "Fully paid only"**  
   When `!hasData` and `paymentEligibility === 'fully_paid_only'`, the empty state now includes:  
   *"With **Fully paid only**, sales with a balance due are hidden. Try **Include due sales** to see all commission-eligible sales."*  
   This directs the user to the filter that will show existing commission sales with balance due.

2. **Default payment eligibility**  
   Default is **Include due sales** so the first load shows all commission-eligible sales (no rows hidden by payment filter).

3. **No change to render condition**  
   The condition `hasData = data && data.summary.length > 0` is correct: when the service returns at least one salesman group with sales, the report table and totals are shown; when it returns none, the empty state is shown.

## Summary

- No bug was found in the render condition or in data being overwritten.
- The “blank” report was due to the **payment eligibility** filter (Fully paid only) excluding all rows; the empty state hint and default **Include due sales** address that.
- If the service ever returns rows but the UI still shows empty, the next step is to add a temporary log of `data?.summary?.length` after `setData` to confirm the state actually received.
