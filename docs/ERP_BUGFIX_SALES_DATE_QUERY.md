# ERP Bugfix: Sales Date Query (400)

## Summary

Sales-related queries were failing with 400 because the code used the column name **`sale_date`**, which does not exist on the `sales` table. The canonical date column is **`invoice_date`**.

## Root Cause

- **Schema:** The `sales` table uses `invoice_date` (and optionally other date fields), not `sale_date`.
- **Code:** Several services and the dashboard were selecting or filtering on `sale_date`, causing Supabase/PostgREST to return 400 (invalid column).

## Changes Made

### 1. `src/app/services/accountingReportsService.ts`

- **Sales profit report query:**  
  - `select(..., 'sale_date', ...)` → `select(..., 'invoice_date', ...)`  
  - `.gte('sale_date', ...)` / `.lte('sale_date', ...)` → `.gte('invoice_date', ...)` / `.lte('invoice_date', ...)`  
  - `.order('sale_date', ...)` → `.order('invoice_date', ...)`  
- **Result mapping:** Rows still expose `sale_date` to the UI; value is set from the DB column: `sale_date: s.invoice_date || ''`.
- **Other report methods:** All remaining `.gte('sale_date', ...)` / `.lte('sale_date', ...)` in this file were changed to use `invoice_date` (same date semantics, correct column).

### 2. `src/app/services/businessAlertsService.ts` (already correct)

- Receivables query already selects `invoice_date`. Overdue filter was previously updated to use `s.invoice_date` (no `sale_date`).

### 3. `src/app/services/financialDashboardService.ts` (already correct)

- Uses `saleDateCol = 'invoice_date'` for all sales date filters; no change needed.

### 4. `src/app/components/dashboard/Dashboard.tsx`

- Dashboard metrics derive from context data that may come from Supabase with `invoice_date` and no `sale_date`.
- All sales date fallbacks updated from `(s.date || s.sale_date || '')` to `(s.date || s.sale_date || s.invoice_date || '')` so that raw API responses using `invoice_date` are handled.

### 5. `src/app/components/reports/SalesProfitPage.tsx`

- No change. It consumes `row.sale_date` from the report API; the report service now populates `sale_date` from `invoice_date`, so the UI continues to work.

## What Was Fixed To

| Location | Before | After |
|----------|--------|--------|
| accountingReportsService (sales profit + other sales queries) | `sale_date` in select, gte, lte, order | `invoice_date` in DB; result still exposes `sale_date` from `invoice_date` |
| businessAlertsService | Already used `invoice_date` | — |
| financialDashboardService | Already used `invoice_date` | — |
| Dashboard.tsx | `s.date \|\| s.sale_date` | `s.date \|\| s.sale_date \|\| s.invoice_date` |

## Verification

- Run Sales by Profit (or equivalent) report for a date range: should load without 400.
- Dashboard sales metrics and “last 7 days” should compute correctly when sales are loaded with `invoice_date`.
- Business alerts (overdue receivables) already use `invoice_date`; no regression.

## Rollback

- In `accountingReportsService.ts`: revert select/filters/order back to `sale_date` and row mapping to `s.sale_date` (will reintroduce 400 unless DB has a `sale_date` column).
- In `Dashboard.tsx`: remove `s.invoice_date` from the fallback chain (dashboard may show wrong/empty dates if API only returns `invoice_date`).
