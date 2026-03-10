# ERP Phase-2 Intelligence System

This document describes the Phase-2 Intelligence and Business Settings upgrades applied to the DIN COUTURE ERP (NEW POSV3).

---

## 1. Features Added

### 1.1 Financial Dashboard (Executive Summary)
- **Metrics:** Today Sales, Today Profit, Monthly Revenue, Monthly Expenses, Profit Margin %, Cash Balance, Bank Balance, Receivables, Payables.
- **Charts:** Sales Trend (7d), Expense Trend (7d), Profit Trend (7d).
- **Performance:** Single RPC `get_financial_dashboard_metrics(company_id)` for sub-1s load.
- **Location:** Main Dashboard (first section “Executive summary”).

### 1.2 Inventory Intelligence
- **Reports (service):**
  - **Fast Moving Products** – high sales velocity (from `stock_movements` + overview movement = Fast).
  - **Slow Moving Products** – movement = Slow, days since last sale.
  - **Dead Stock** – movement = Dead, stock value, days since movement.
  - **Low Stock Alerts** – status Low or Out from inventory overview.
  - **Inventory Turnover** – COGS sold / avg stock value, days cover.
- **Service:** `src/app/services/inventoryIntelligenceService.ts` (uses `inventoryService.getInventoryOverview` + `getInventoryMovements`).
- **UI:** Use from Reports or Inventory Analytics test page; APIs ready for any dedicated “Inventory Intelligence” report view.

### 1.3 Profit Analysis
- **Profit by Product** – revenue, cost, profit, margin % per product (from `sales` + `sale_items` + `products`).
- **Profit by Category** – same aggregated by `product_categories`.
- **Profit by Customer** – same aggregated by `customer_id` / contacts.
- **Location:** `accountingReportsService.getProfitByProduct`, `getProfitByCategory`, `getProfitByCustomer`.

### 1.4 Cash Flow Statement
- **Sections:** Operating Activities, Investing Activities, Financing Activities.
- **Logic:** Uses `journal_entries` + `journal_entry_lines`; cash/bank account lines classified by the other leg’s account type (revenue/expense/AR/AP → Operating; non-cash asset → Investing; liability/equity → Financing).
- **API:** `accountingReportsService.getCashFlowStatement(companyId, startDate, endDate, branchId?)`.

### 1.5 Business Alert Engine
- **Alert types:** Low stock, Dead stock, High expenses, Profit drop, Overdue receivables, Overdue payables.
- **Evaluation:** On-demand (no cron); called when dashboard loads.
- **Service:** `src/app/services/businessAlertsService.ts` → `getBusinessAlerts(companyId)`.
- **UI:** Alert strip on main Dashboard (up to 5 alerts with “View” link).

### 1.6 Automated Reports (Foundation)
- **Current:** On-demand PDF/Excel export exists for many reports (Sales Profit, P&L, Trial Balance, Balance Sheet, etc.) via `exportUtils.ts`.
- **Added for Phase-2:** No new scheduled cron or email delivery; structure is in place for daily/weekly/monthly summary and optional n8n/WhatsApp/email later (e.g. Edge Function or external scheduler calling same report APIs + export).

### 1.7 Business Settings (Centralized)
- **Existing:** Company name, currency, timezone, date format, financial year start, invoice prefix, logo, numbering rules in `SettingsContext` and DB (`companies`, `settings`).
- **Phase-2:** Global settings engine with caching so any module can read settings without repeated DB hits.

### 1.8 New Business / Onboarding
- **Existing:** `CreateBusinessWizard` + `create_business_transaction` RPC (company, branch, user, currency, timezone, financial_year_start); default accounts and sequences created.
- **Phase-2:** No change to flow; documented as part of “New Business creation flow” and “initialize default accounts, settings, sequences.”

### 1.9 Global Settings Engine
- **API:** `globalSettingsService.getSetting<T>(companyId, key)`.
- **Cache:** In-memory, TTL 1 minute; `invalidateSetting(companyId, key?)` to clear.
- **Resolution:** Known keys (e.g. `currency`, `timezone`, `company_name`, `financial_year_start`, `invoice_prefix`, `logo`, `symbol`) resolved from `companies`; others from `settings` table.
- **File:** `src/app/services/globalSettingsService.ts`.

---

## 2. Files Modified / Created

### New files
- `migrations/financial_dashboard_metrics_rpc.sql` – RPC `get_financial_dashboard_metrics(p_company_id)`.
- `src/app/services/financialDashboardService.ts` – Executive metrics (RPC + fallback).
- `src/app/services/inventoryIntelligenceService.ts` – Fast/slow/dead stock, low stock alerts, turnover.
- `src/app/services/businessAlertsService.ts` – Alert evaluation (low stock, dead stock, high expenses, profit drop, overdue receivables/payables).
- `src/app/services/globalSettingsService.ts` – `getSetting(key)` with cache.
- `docs/ERP_PHASE2_INTELLIGENCE_SYSTEM.md` – this file.

### Modified files
- `src/app/components/dashboard/Dashboard.tsx` – Executive summary section, financial metrics, trend charts, business alerts strip.
- `src/app/services/accountingReportsService.ts` – `getCashFlowStatement`, `getProfitByProduct`, `getProfitByCategory`, `getProfitByCustomer`.

### Unchanged (no breaking changes)
- Accounting journal logic, RLS policies, table drops, existing modules (Sales, Purchases, Expenses, Inventory, Studio, Accounting reports) remain as-is.

---

## 3. Queries Used

### Financial dashboard (RPC)
- **Today / month:** Aggregates on `sales` (total, due_amount), `purchases` (total, due_amount), `expenses` (amount) with date filters.
- **Cash/Bank:** `accounts` where code = 1000/1010 or type cash/bank; balance from `balance` or `current_balance`.
- **Trend:** Same tables, daily aggregates for last 7 days.

### Inventory intelligence
- **Source:** `inventoryService.getInventoryOverview` (products + stock from `stock_movements`), `getInventoryMovements` (filtered by company, branch, date).
- **Classification:** Overview already provides `status` (Low/OK/Out) and `movement` (Fast/Medium/Slow/Dead); reports filter and aggregate.

### Cash flow
- **Source:** `journal_entries` (date range) → `journal_entry_lines` for cash/bank accounts; other leg’s `accounts.type` used to classify Operating / Investing / Financing.

### Profit by product / category / customer
- **Source:** `sales` (final) + `sale_items` + `products` (cost_price/cost, category); aggregation by product_id, category_id, or customer_id.

---

## 4. Settings Architecture

- **Company-level:** Stored in `companies` (e.g. name, currency, timezone, financial_year_start) and/or `settings` (key-value).
- **Usage:** Prefer `globalSettingsService.getSetting(companyId, key)` for cached reads; continue using `SettingsContext` for reactive UI and updates.
- **Keys (examples):** `currency`, `timezone`, `company_name`, `financial_year_start`, `invoice_prefix`, `logo`, `symbol`, and any key in `settings` table.

---

## 5. Alerts System

- **Engine:** `businessAlertsService.getBusinessAlerts(companyId)`.
- **Rules:**
  - **Low stock:** `inventoryIntelligenceService.getLowStockAlerts` → count > 0.
  - **Dead stock:** `getDeadStock` → count and total value.
  - **High expenses:** `getFinancialDashboardMetrics` → monthly_expenses / monthly_revenue > 0.9.
  - **Profit drop:** monthly_profit < 0.
  - **Overdue receivables:** `sales` with due_amount > 0 and sale_date in the past.
  - **Overdue payables:** `purchases` with due_amount > 0 and po_date in the past.
- **Display:** Dashboard alert strip; severity (info / warning / critical) and optional action view (inventory, accounting, reports, etc.).

---

## 6. Applying the Migration

Run the financial dashboard RPC migration on your Supabase project:

```bash
# From project root, apply migration (adjust for your Supabase CLI)
psql $DATABASE_URL -f migrations/financial_dashboard_metrics_rpc.sql
# or
supabase db push
# (if the migration is in your migrations folder and tracked)
```

If the RPC is not present, the dashboard uses the fallback in `financialDashboardService.ts` (parallel lightweight queries).

---

## 7. Optional Next Steps

- **Scheduled reports:** Cron or Edge Function to generate daily/weekly/monthly summary and send via email/n8n/WhatsApp.
- **Inventory Intelligence UI:** Dedicated report page that calls `inventoryIntelligenceService` and displays Fast/Slow/Dead, Low Stock, Turnover tables.
- **Cash Flow & Profit reports UI:** Wire `getCashFlowStatement`, `getProfitByProduct`, `getProfitByCategory`, `getProfitByCustomer` to report pages with filters and PDF/Excel export (reuse existing exportUtils).
- **New Business flow:** Add optional “Country” and “Owner name” to Create Business wizard if desired; backend already supports currency, timezone, financial year start and initializes default accounts and sequences.
