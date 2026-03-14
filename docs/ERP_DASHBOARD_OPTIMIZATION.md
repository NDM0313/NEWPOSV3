# ERP Dashboard Optimization Plan (Safe Cleanup Plan)

**Goal:** Reduce dashboard queries to **1–2 RPC calls** (or one RPC + one lightweight query). Design a **dashboard_metrics** RPC or materialized view. **No schema or code changes in this phase** — design and plan only.

---

## 1. Current dashboard loading (web)

From `Dashboard.tsx` and related services:

| # | Call | When | Notes |
|---|------|------|------|
| 1 | **getFinancialDashboardMetrics(companyId)** | On load | Uses RPC **get_financial_dashboard_metrics** when available; on failure falls back to **getMetricsFallback**. |
| 2 | **getSalesByCategory(companyId, start, end)** | On load (date range from GlobalFilter) | ① sales (id, company_id, status, invoice_date) ② sales_items or sale_items (sale_id, total, product→category). Two round-trips. |
| 3 | **getBusinessAlerts(companyId)** | On load | businessAlertsService. |
| 4 | **productService.getLowStockProducts(companyId)** | On load | Low stock list. |

**getFinancialDashboardMetrics:**

- **Primary:** Single RPC `get_financial_dashboard_metrics(p_company_id)` → returns today_sales, today_profit, monthly_* , cash_balance, bank_balance, receivables, payables, sales_trend, expense_trend, profit_trend.
- **Fallback (getMetricsFallback):** **9 parallel Supabase queries**: sales (today), sales (month), purchases (today), purchases (month), expenses (today), expenses (month), sales (due_amount), purchases (due_amount), accounts (code, balance, type). Then trend arrays filled with zeros (no extra queries).

So when RPC exists: **1 RPC + getSalesByCategory (2 queries) + getBusinessAlerts (1) + getLowStockProducts (1)** ≈ **5 call groups**.  
When RPC missing: **9 + 2 + 1 + 1 = 13** queries (fallback).

---

## 2. Target: 1–2 RPC queries

**Option A — Single RPC “dashboard_metrics”**

- One RPC that returns:
  - All fields currently returned by **get_financial_dashboard_metrics** (today/monthly metrics, balances, receivables, payables, trends).
  - **Sales by category** for the current global date range (or last 30 days): array of `{ categoryName, total }`.
  - **Low-stock count** or top N low-stock items (e.g. id, name, current_stock, min_stock).
- **Business alerts** can remain a separate small call (or be included in the same RPC if desired).

**Option B — Two RPCs**

1. **get_financial_dashboard_metrics** (existing or extended): Keep as-is or extend with sales_trend/expense_trend/profit_trend from DB.
2. **get_dashboard_secondary** (new): Returns (sales_by_category, low_stock_items, optional alerts).

**Recommendation:** **Option A** — single **get_dashboard_metrics** RPC with parameters:

- `p_company_id UUID`
- `p_branch_id UUID` (optional)
- `p_start_date DATE` (optional, for sales-by-category range)
- `p_end_date DATE` (optional)

Returns one JSON object:

- Financial metrics (today/monthly, balances, receivables, payables, trends).
- `sales_by_category`: `[{ categoryName, total }]`.
- `low_stock_items`: `[{ id, name, sku, current_stock, min_stock }]` (e.g. top 20 or all below min_stock).
- Optionally `alerts`: array from business alerts logic.

That reduces the dashboard to **1 RPC** (+ optional 1 small call for alerts if not in RPC).

---

## 3. Design: get_dashboard_metrics RPC

### 3.1 Signature (example)

```sql
CREATE OR REPLACE FUNCTION get_dashboard_metrics(
  p_company_id UUID,
  p_branch_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_metrics JSONB;      -- today/monthly, balances, trends
  v_sales_by_cat JSONB; -- [{ categoryName, total }]
  v_low_stock JSONB;    -- [{ id, name, sku, current_stock, min_stock }]
BEGIN
  -- 1) Reuse or inline logic from get_financial_dashboard_metrics
  --    (today_sales, monthly_revenue, cash_balance, etc.)
  -- 2) Sales by category for p_start_date..p_end_date
  --    (from sales + sales_items/sale_items + products + product_categories)
  -- 3) Low stock: products where current_stock < min_stock (or from stock_movements/inventory_balance)
  v_metrics := ...;
  v_sales_by_cat := ...;
  v_low_stock := ...;
  v_result := jsonb_build_object(
    'metrics', v_metrics,
    'sales_by_category', v_sales_by_cat,
    'low_stock_items', v_low_stock
  );
  RETURN v_result;
END;
$$;
```

### 3.2 Implementation notes

- **Metrics:** Reuse existing logic from **get_financial_dashboard_metrics** (sales/purchases/expenses/accounts aggregates). If that RPC exists, call it from inside get_dashboard_metrics or duplicate its logic to avoid two round-trips.
- **Sales by category:** Same logic as dashboardService.getSalesByCategory: filter sales by company_id, status = 'final', invoice_date between p_start_date and p_end_date; join to sales_items (or sale_items) and products/product_categories; aggregate by category name. Return JSON array.
- **Low stock:** If **inventory_balance** exists and is maintained: select product_id, product name, current qty, min_stock where company_id = p_company_id and (branch_id = p_branch_id or branch_id is null) and balance < min_stock. If using **stock_movements** only: compute current_stock per product (and optionally per branch) in the RPC or via a helper view/function; then filter by min_stock. Limit rows (e.g. 50) to keep payload small.
- **RLS:** Run as SECURITY DEFINER with explicit search_path; enforce p_company_id (and p_branch_id) so users only see their company/branch data.

### 3.3 Materialized view alternative

- **Option:** Materialized view **dashboard_metrics_mv** (company_id, branch_id, period_type, metrics_json, sales_by_category_json, low_stock_json, refreshed_at). Refreshed periodically (e.g. every 5–15 min) or on demand.
- **Downside:** Stale data; more complexity (refresh job, invalidation). Prefer **single RPC** for freshness unless dashboard load is very high.

---

## 4. Frontend change (when implementing)

- Replace:
  - getFinancialDashboardMetrics(companyId)
  - getSalesByCategory(companyId, start, end)
  - productService.getLowStockProducts(companyId)  
  with one call:  
  **supabase.rpc('get_dashboard_metrics', { p_company_id, p_branch_id, p_start_date, p_end_date })**.
- Parse response: metrics → financial cards/trends; sales_by_category → category chart; low_stock_items → low stock list.
- Keep getBusinessAlerts(companyId) as a second call unless merged into the RPC.

---

## 5. Summary

| Current | Target |
|---------|--------|
| 1 RPC (or 9 queries) + 2 + 1 + 1 ≈ 5–13 calls | **1 RPC** (get_dashboard_metrics) + optional 1 (alerts) |

**Design:** Single **get_dashboard_metrics** RPC returning financial metrics, sales_by_category, and low_stock_items (and optionally alerts). No schema or code changes in this phase — implement in a later step.

---

*This document is part of the safe cleanup plan. No schema or data was modified.*
