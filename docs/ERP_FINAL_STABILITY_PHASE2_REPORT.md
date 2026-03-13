# ERP Final Stability Phase 2 Report

**Date:** 2026-03-13  
**Scope:** Product duplicate create, duplicate UI loads, sales date query 400, and performance validation.

---

## Issue 1 — Product saving twice

| Item | Detail |
|------|--------|
| **Root cause** | UI-side double execution: no synchronous submit guard, so a second click (or StrictMode) could run `onSubmit` again before `saving` was true; buttons remained clickable. |
| **DB vs UI** | **UI-side.** The DB received two INSERTs only when the UI triggered create twice; no duplicate row at DB level for a single request. |
| **Fix** | Submit lock via `submitInProgressRef` at top of `onSubmit`; clear ref on early return and in `finally`; Save buttons `disabled={saving}` and "Saving..." label. |
| **Files changed** | `src/app/components/products/EnhancedProductForm.tsx` |
| **Before** | One click could create two products (two rows in list and DB). |
| **After** | One user action creates exactly one product; double-click/second submit ignored. |
| **Rollback** | Revert EnhancedProductForm: remove submitInProgressRef, ref check/reset, and button disabled/Saving state. |

---

## Issue 2 — Repeated global loads / slow UI

| Item | Detail |
|------|--------|
| **Root cause** | Overlapping async calls to loadAllSettings, getInventoryOverview, and getStockMovements with no in-flight guards, causing duplicate `console.time` and "already exists" timer warnings. |
| **Fix** | In-flight guards: SettingsContext ref; inventoryService and productService module-level Maps keyed by (company/branch) or (product/company/variation/branch), returning existing promise when one is already running. |
| **Files changed** | `src/app/context/SettingsContext.tsx`, `src/app/services/inventoryService.ts`, `src/app/services/productService.ts` |
| **Removed / reduced** | Duplicate concurrent runs of loadAllSettings; duplicate concurrent getInventoryOverview for same company/branch; duplicate concurrent getStockMovements for same product/params. Timer warnings from these flows should disappear or be greatly reduced. |
| **Before** | Logs: "loadAllSettings started multiple times", "Timer 'loadAllSettings' already exists", "inventoryOverview:parallel already exists", "stockMovements:&lt;id&gt; already exists". |
| **After** | Only one load per scope at a time; repeated callers get the same in-flight promise; no duplicate timers for the same key. |
| **Rollback** | Revert the three files: remove ref/guard in SettingsContext; remove Map and inner implementations in inventoryService and productService. |

---

## Issue 3 — Sales query 400 (sale_date)

| Item | Detail |
|------|--------|
| **Root cause** | Code used column **sale_date** on `sales` table; schema uses **invoice_date**. Supabase/PostgREST returned 400 for invalid column. |
| **Fix** | All sales queries use **invoice_date** for select, filters, and order. Report API still exposes **sale_date** to UI by mapping `sale_date: s.invoice_date`. Dashboard date fallback extended to `s.invoice_date`. |
| **Files changed** | `src/app/services/accountingReportsService.ts`, `src/app/components/dashboard/Dashboard.tsx` (businessAlertsService and financialDashboardService already used invoice_date) |
| **sale_date fixed to** | **invoice_date** in the database layer; UI/interface can keep using `sale_date` where the value is populated from `invoice_date`. |
| **Before** | Sales report and any query filtering/ordering by sale_date could return 400. |
| **After** | Sales profit report and dashboard sales metrics use invoice_date; no 400 from sale_date. |
| **Rollback** | In accountingReportsService revert select/filters/order to sale_date and row mapping to s.sale_date; in Dashboard remove s.invoice_date from fallback (may break if API returns only invoice_date). |

---

## Issue 4 — Performance validation

| Item | Detail |
|------|--------|
| **Deliverable** | `docs/ERP_UI_PERFORMANCE_VALIDATION.md` |
| **Content** | Test matrix (contact/product/purchase/sale create, open product stock ledger), regression checks (purchase double stock, on-account payments, ledger, shipping), before/after summary, how to run and record timings. |
| **Regressions to confirm absent** | Purchase double stock posting; on-account payments; ledger (no studio_orders); shipping in sales. |

---

## Deliverables summary

| Doc | Purpose |
|-----|--------|
| `docs/ERP_BUGFIX_PRODUCT_DUPLICATE_CREATE.md` | Product double-save root cause, fix, verification, rollback |
| `docs/ERP_BUGFIX_DUPLICATE_UI_LOADS.md` | Repeated loads root cause, in-flight guards, files, rollback |
| `docs/ERP_BUGFIX_SALES_DATE_QUERY.md` | sale_date → invoice_date, files changed, verification, rollback |
| `docs/ERP_UI_PERFORMANCE_VALIDATION.md` | Test matrix, regression checks, before/after, timing placeholder |
| `docs/ERP_FINAL_STABILITY_PHASE2_REPORT.md` | This report |

---

## Exact files changed (all issues)

- `src/app/components/products/EnhancedProductForm.tsx` — submit lock, button disabled/Saving
- `src/app/context/SettingsContext.tsx` — loadAllSettings in-flight ref
- `src/app/services/inventoryService.ts` — getInventoryOverview in-flight Map
- `src/app/services/productService.ts` — getStockMovements in-flight Map
- `src/app/services/accountingReportsService.ts` — sale_date → invoice_date in queries and row mapping
- `src/app/components/dashboard/Dashboard.tsx` — sales date fallback includes invoice_date

No tables dropped, no core tables renamed, no destructive cleanup. Existing accounting and stabilization fixes (purchase double stock, on-account payments, ledger, shipping) preserved.
