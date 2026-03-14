# ERP Dashboard RPC Implementation

**Date:** 2026-03-13  
**Phase:** Final stabilization — reduce dashboard from 5–13 calls to 1 RPC (+ optional alerts).

---

## Summary

- **New RPC:** `get_dashboard_metrics(p_company_id, p_branch_id, p_start_date, p_end_date)` returns one JSON object with:
  - **metrics** — same shape as `get_financial_dashboard_metrics` (today/monthly figures, cash/bank, receivables/payables, trends).
  - **sales_by_category** — array of `{ categoryName, total }` for the given date range.
  - **low_stock_items** — array of `{ id, name, sku, current_stock, min_stock }` (up to 50), from `inventory_balance` + `products` when available.
- **Frontend:** Dashboard uses `getDashboardMetrics()` from `financialDashboardService`; on success a single effect sets financial metrics, sales-by-category, and low-stock state. On RPC failure, the service falls back to separate calls (financial RPC/fallback + dashboardService.getSalesByCategory + productService.getLowStockProducts).

---

## Query reduction

| Before | After (RPC available) |
|--------|------------------------|
| 1× get_financial_dashboard_metrics (or 9 fallback queries) | 1× get_dashboard_metrics |
| 1× getSalesByCategory (sales + sales_items/sale_items) | (included in RPC) |
| 1× productService.getLowStockProducts (inventory overview + movements) | (included in RPC) |
| 1× getBusinessAlerts | 1× getBusinessAlerts (unchanged) |
| **Total: 4–13 calls** | **Total: 2 calls** |

---

## Files changed

- **migrations/erp_get_dashboard_metrics_rpc.sql** — Defines `get_dashboard_metrics`. Uses existing `get_financial_dashboard_metrics`, detects `sales_items` vs `sale_items` and `sale_date` vs `invoice_date`, and optionally builds low_stock from `inventory_balance`.
- **src/app/services/financialDashboardService.ts** — Added `getDashboardMetrics()`, `DashboardMetricsPayload`, `DashboardLowStockItem`; fallback uses existing financial + dashboard + product services.
- **src/app/components/dashboard/Dashboard.tsx** — Single effect calling `getDashboardMetrics(companyId, branchId, startDate, endDate)`; sets metrics, sales_by_category, low_stock; single `loading` state; alerts still loaded separately.

---

## Rollback

- **Frontend:** Revert Dashboard.tsx and financialDashboardService.ts to previous behavior (three separate effects and no `getDashboardMetrics`).
- **DB:** Drop function if needed: `DROP FUNCTION IF EXISTS get_dashboard_metrics(UUID, UUID, DATE, DATE);`

---

## Notes

- RPC is read-only and company-scoped; branch and date range are optional.
- Low-stock in RPC uses `inventory_balance` when present; otherwise returns `[]` (frontend fallback still uses productService.getLowStockProducts when RPC fails).
- Alerts remain a separate call to keep the RPC payload small and avoid coupling to business-alerts logic.
