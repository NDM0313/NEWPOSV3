# Dashboard V2 — Audit (Phase 1)

**Date:** 2026-06-06  
**Replaces:** Monolithic [`Dashboard.tsx`](../src/app/components/dashboard/Dashboard.tsx)  
**Goal:** Read-only ERP business snapshot with unified data contract.

---

## 1. Current file inventory

### UI

| File | Role |
|------|------|
| `src/app/components/dashboard/Dashboard.tsx` | Main home dashboard (~920 lines) — **replace** |
| `src/app/components/dashboard/DashboardRevenueChart.tsx` | Lazy area chart — fold into V2 or remove |
| `src/app/components/dashboard/StockDashboard.tsx` | Separate `stock` view (demo) — keep route |
| `src/app/components/dashboard/ExpensesDashboard.tsx` | Separate `expenses` view — keep route |
| `src/app/App.tsx` | `currentView === 'dashboard'` → Dashboard |
| `src/app/components/layout/TopHeader.tsx` | Global date + branch filter |
| `src/app/context/GlobalFilterContext.tsx` | Filter persistence; dashboard default `last7days` |

### Services

| File | Role |
|------|------|
| `financialDashboardService.ts` | `getDashboardMetrics` → `get_dashboard_metrics` RPC |
| `dashboardService.ts` | `getSalesByCategory` fallback |
| `businessAlertsService.ts` | Top banner alerts (low stock, overdue AR/AP) |
| `inventoryIntelligenceService.ts` | `getLowStockAlerts` (movement-based) |
| `productService.ts` | `getLowStockProducts` via inventory overview |
| `inventoryService.ts` | **Canonical** `getInventoryOverview` (stock_movements) |

### RPCs / migrations

| Object | Migration |
|--------|-----------|
| `get_dashboard_metrics` | `20260606120000_dashboard_metrics_branch_scope.sql` (latest period+branch) |
| `get_financial_dashboard_metrics` | `20260370_phase2a2_ledger_sales_branch_dashboard_contact_ar_ap.sql` |
| `get_contact_balances_summary` | Used for AR/AP in dashboard RPC |

**VPS checklist:** Ensure `20260606120000` applied before trusting period/branch metrics.

---

## 2. Per-metric source map (current)

| Metric | Source | GL vs Operational | Date filter | Branch filter |
|--------|--------|-------------------|-------------|---------------|
| Period sales | `sales` status=`final` | Operational | `invoice_date`/`sale_date` | Yes (20260606+) |
| Period purchases | `purchases` final/received | Operational | `po_date` | Yes |
| Period OpEx | `expenses` status=`paid` | Operational | `expense_date` | Yes |
| Net profit | sales − purchases − OpEx | Operational estimate | Period | Yes |
| Cash / bank | JE lines on liquidity accounts | GL | As-of today | Company-wide |
| Receivables / payables | `get_contact_balances_summary` | Operational party roll-up | Point-in-time | Branch when set |
| Low stock (RPC) | `inventory_balance` qty `< min_stock` | Operational | N/A | Yes |
| Low stock (alerts) | `getInventoryOverview` status Low/Out | Movement-based | N/A | Often **none** |
| Sales by category | `sales_items` join | Operational | Period | Yes |

---

## 3. Mismatch root causes

### 3.1 Low stock alert count ≠ Critical Stock panel

- **Alert banner:** `getBusinessAlerts` → `getLowStockAlerts` → movement overview, `stock <= min_stock`, company-wide.
- **Critical Stock:** RPC `inventory_balance` with `qty < min_stock` (strict), or `productService` for non-exec; UI shows **max 5** rows.
- **Fix (V2):** Single path via `inventoryService.getInventoryOverview` + `dashboardV2Stock.ts` mapper.

### 3.2 Zeros under wide date filter (e.g. fromStart 2016→today)

- May be correct if no `final` sales in range; UI lacked empty-state explanation.
- If migration `20260606120000` not applied, period fields may not reflect global filter.

### 3.3 Cash/bank without branch split

- RPC keeps GL liquidity company-wide; no per-account breakdown in UI.

### 3.4 Parallel fetches

- `getBusinessAlerts`, `getDashboardMetrics`, context hooks — no single contract.

### 3.5 AR/AP alerts vs cards

- Cards: `get_contact_balances_summary`; alerts: document `due_amount` on sales/purchases — different basis.

---

## 4. Replacement map

| Old | New |
|-----|-----|
| `Dashboard.tsx` | `dashboard/v2/DashboardV2Page.tsx` |
| `getBusinessAlerts` on dashboard | `ActionRequiredPanel` from `dashboardV2Service` snapshot |
| RPC `low_stock_items` for UI | `dashboardV2Stock` + `getInventoryOverview` |
| `DashboardRevenueChart.tsx` | `MoneyFlowCharts.tsx` |
| — | `dashboardV2Service.ts` |
| — | `get_dashboard_v2_snapshot` RPC (additive) |
| — | `useDashboardV2.ts` |

---

## 5. V2 safety

- Read-only; no GL/posting/mutation changes.
- Additive migration only.
