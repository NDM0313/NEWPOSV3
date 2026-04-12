# 17 — Dashboard and Metrics Source Map

**Last updated:** 2026-04-12
**Stack:** Next.js + Supabase (multi-tenant)
**Scope:** All dashboard KPI metrics, trend charts, and financial report engines

---

## Business Purpose

The Dashboard and Reports layer provides two distinct tiers of financial visibility:

1. **Executive Dashboard** — real-time KPI cards (today's sales, monthly revenue, cash/bank balance, receivables/payables, profit margin) loaded in a single RPC call. Optimised for sub-1-second load. Uses operational tables as an accepted shortcut for revenue/expense metrics. Cash and bank balances are GL-sourced.
2. **Financial Reports Engine** — formal accounting reports (Trial Balance, Balance Sheet, P&L, Day Book, Roznamcha, Commission) that are always GL-canonical: every figure is derived exclusively from `journal_entries` + `journal_entry_lines` joined to `accounts`, except Roznamcha and Commission which have explicit documented exceptions.

These two tiers intentionally use different data sources. Mixing them for the same metric is an architecture violation.

---

## UI Entry Points

| View / Route | Component | Description |
|---|---|---|
| `/dashboard` | `Dashboard` (or `FinancialDashboard`) | Executive KPI cards, trend charts, sales-by-category pie, low-stock alert list |
| `/reports` | `ReportsDashboard` | Navigation hub for all formal financial reports |
| `/reports/trial-balance` | `TrialBalancePage` | GL debit/credit totals per account for a date range; flat / summary / expanded AR-AP modes |
| `/reports/balance-sheet` | `BalanceSheetPage` | Assets = Liabilities + Equity as at a date; AR/AP shown as rolled control totals |
| `/reports/profit-loss` | `ProfitLossPage` | Revenue − COS = Gross Profit; Gross Profit − Expenses = Net Profit; optional comparison period |
| `/reports/day-book` | `DayBookReport` | Per-account or all-accounts journal line view for a date range |
| `/reports/roznamcha` | `RoznamchaReport` | Daily Cash Book showing cash IN / OUT movements; source is `payments` table, not JE lines |
| `/reports/commission` | Commission Report page | Salesman commission summary per period; source is `sales` table columns |

---

## Frontend Files

| File | Role |
|---|---|
| `src/app/components/reports/ReportsDashboard.tsx` | Navigation hub for all financial reports |
| `src/app/components/reports/TrialBalancePage.tsx` | Renders `TrialBalanceResult`; supports flat / summary / expanded AR/AP modes |
| `src/app/components/reports/BalanceSheetPage.tsx` | Renders `BalanceSheetResult`; AR and AP appear as rolled-up control totals with party drilldown |
| `src/app/components/reports/ProfitLossPage.tsx` | Renders `ProfitLossResult` with optional comparison period |
| `src/app/components/reports/DayBookReport.tsx` | Per-account or all-accounts journal view; source: `journal_entry_lines` |
| `src/app/components/reports/RoznamchaReport.tsx` | Daily Cash Book; source: `payments` table (NOT journal lines) |

---

## Backend Services

| Service | File | Responsibility |
|---|---|---|
| `financialDashboardService` | `src/app/services/financialDashboardService.ts` | Primary dashboard entry point. Calls `get_dashboard_metrics` RPC (single call). Falls back to parallel operational queries + GL journal call for cash/bank. |
| `dashboardService` | `src/app/services/dashboardService.ts` | `getSalesByCategory` — aggregates `sales_items` (or `sale_items`) totals by product category for the category pie chart. Operational source. |
| `accountingReportsService` | `src/app/services/accountingReportsService.ts` | `getTrialBalance`, `getProfitLoss`, `getBalanceSheet`, `getAccountBalancesFromJournal`, `getArApGlSnapshot`. All GL-canonical. |
| `roznamchaService` | `src/app/services/roznamchaService.ts` | `getRoznamcha` — builds Cash In/Out from `payments` table rows, classified by liquidity bucket (cash/bank/wallet). NOT from journal lines. |
| `commissionReportService` | `src/app/services/commissionReportService.ts` | Reads `sales.commission_amount`, `sales.commission_status`, `sales.commission_batch_id`. Operational source (sale-level capture). |

**RPC functions used by dashboard:**

| RPC | Purpose |
|---|---|
| `get_dashboard_metrics` | Combined payload: metrics + sales_by_category + low_stock_items in one DB call |
| `get_financial_dashboard_metrics` | Metrics-only variant (used when combined RPC not available) |

---

## Dashboard Metrics Table

All primary-path metrics come from `get_dashboard_metrics` RPC. The fallback path (when RPC unavailable) is documented in the "Source" column.

| Metric | RPC Field | Fallback Data Source | Table(s) | GL or Operational | Date Range Applied | Branch Filter | Known Accuracy Issues |
|---|---|---|---|---|---|---|---|
| Today's Sales | `today_sales` | `sales.total` WHERE `status='final'` AND `invoice_date = today` | `sales` | **Operational** | Today only (server date) | Via RPC param; fallback: company-wide | Does not subtract sale returns. Excludes drafts/cancelled. |
| Today's Profit | `today_profit` | `today_sales − today_purchases − today_expenses` | `sales`, `purchases`, `expenses` | **Operational** | Today only | Via RPC param; fallback: company-wide | Profit = sales minus purchases (status in PURCHASE_POSTED_ACCOUNTING_STATUSES) minus expenses (status='paid'). COGS not computed from GL — uses purchase totals as proxy. Will diverge from GL P&L. |
| Monthly Revenue | `monthly_revenue` | `sales.total` WHERE `status='final'` AND `invoice_date` in current calendar month | `sales` | **Operational** | Calendar month (1st to last day) | Via RPC param | Excludes sale returns. Does not use JE lines account 4100. Accepted shortcut — see Source of Truth section. |
| Monthly Expenses | `monthly_expenses` | `purchases.total` (posted statuses) + `expenses.amount` (paid) for month | `purchases`, `expenses` | **Operational** | Calendar month | Via RPC param | Combines inventory spend (purchases) and operating expenses — may overstate true operating expenses. |
| Monthly Profit | `monthly_profit` | `monthly_revenue − monthly_expenses` | Derived | **Operational** | Calendar month | Via RPC param | Same caveats as today_profit. Will not match GL P&L. |
| Profit Margin % | `profit_margin_pct` | `(monthly_revenue − monthly_expenses) / monthly_revenue × 100` | Derived | **Operational** | Calendar month | Via RPC param | Inherits all operational inaccuracies above. |
| Cash Balance | `cash_balance` | `getAccountBalancesFromJournal` → accounts with `code='1000'` or `type='cash'` | `journal_entry_lines`, `journal_entries`, `accounts` | **GL** | All time up to today | Via RPC param; fallback: company-wide | GL-correct. Will differ from Roznamcha running balance (Roznamcha is payments-only). |
| Bank Balance | `bank_balance` | `getAccountBalancesFromJournal` → accounts with `code='1010'` or `type='bank'` | `journal_entry_lines`, `journal_entries`, `accounts` | **GL** | All time up to today | Via RPC param; fallback: company-wide | GL-correct. Includes all bank accounts aggregated. |
| Receivables (AR) | `receivables` | `sales.due_amount` WHERE `status='final'` AND `due_amount > 0` | `sales` | **Operational** | No date filter — all open balances | Via RPC param | Does not match GL AR (account 1100). Excludes manually entered AR, opening balances, and partial allocations from manual receipts. Use TB account 1100 for GL truth. |
| Payables (AP) | `payables` | `purchases.due_amount` WHERE status in posted list AND `due_amount > 0` | `purchases` | **Operational** | No date filter — all open balances | Via RPC param | Does not match GL AP (account 2000). Same caveats as receivables. |
| Period Purchases | `period_purchases` | `purchases.total` WHERE status in posted statuses AND date in period | `purchases` | **Operational** | Current month | Via RPC param | Includes all posted purchase totals regardless of payment status. |
| Period Operating Expenses | `period_operating_expenses` | `expenses.amount` WHERE `status='paid'` AND date in period | `expenses` | **Operational** | Current month | Via RPC param | Expenses module only; excludes purchase inventory spend. |
| Sales by Category | `sales_by_category` | `sales_items.total` grouped by `products.category_id → product_categories.name` | `sales`, `sales_items` (or `sale_items`), `products`, `product_categories` | **Operational** | User-selected date range (p_start_date / p_end_date) | Via RPC param | Fallback tries `sales_items` first, then legacy `sale_items`. Totals from line item `total` column, not invoice total. |
| Low Stock Items | `low_stock_items` | `productService.getLowStockProducts` → products WHERE `current_stock < min_stock` | `products` (or `inventory_balance`) | **Operational** | Point-in-time snapshot | Company-wide | Stock qty may be stale if `inventory_balance` table is used instead of `stock_movements` SUM. See Source of Truth matrix. |
| Sales Trend (7-day) | `sales_trend` | Daily `sales.total` aggregates (filled by RPC; zeros in fallback) | `sales` | **Operational** | Last 7 days | Via RPC param | Fallback path returns zeros for all trend days to avoid extra round-trips. |
| Expense Trend | `expense_trend` | Daily expense aggregates | `expenses` | **Operational** | Last 7 days | Via RPC param | Zeros in fallback mode. |
| Profit Trend | `profit_trend` | Derived daily profit | Derived | **Operational** | Last 7 days | Via RPC param | Zeros in fallback mode. |

---

## Financial Reports Engine

### Trial Balance

- **Source:** `journal_entry_lines` joined to `journal_entries` (filtered by `company_id`, `entry_date` range, `is_void = false`), joined to `accounts`
- **How computed:** `SUM(debit)` and `SUM(credit)` per `account_id` for the given date range and branch filter. Accounts with zero activity are excluded from output rows.
- **Branch filter:** `journal_entries.branch_id` must match filter, OR `branch_id IS NULL` (company-wide opening entries and legacy rows are always included).
- **AR/AP presentation modes:**
  - `flat` — one row per account, no grouping
  - `summary` — AR family (1100 + subledger children) collapsed to one rolled row; same for AP (2000)
  - `expanded` — control account first, then indented party subledger children
- **Service function:** `accountingReportsService.getTrialBalance`
- **Note:** `assertGlTruthQueryTable` guard is called to prevent accidental use of non-GL tables.

### Balance Sheet

- **Source:** Trial balance from `'1900-01-01'` to `asOfDate` (cumulative all-time), filtered to asset / liability / equity account types.
- **How computed:** Calls `getTrialBalance` with start `1900-01-01`. AR (1100) balance is rolled up including all party subledger children. AP (2000) same. Revenue and expense accounts (P&L) contribute their net balance to retained earnings implicitly (not yet split into a retained earnings line — the difference column flags this when BS is out of balance).
- **Service function:** `accountingReportsService.getBalanceSheet`

### Profit & Loss

- **Source:** Trial balance for the selected date range, filtered to `revenue` and `expense` account types.
- **How computed:**
  - Revenue = `credit − debit` for accounts where `type` in `['revenue', 'income']`
  - Cost of Sales = `debit − credit` for expense accounts where `code` in `{5000, 5010, 5100, 5110}` or `type` contains `'cogs'` / `'cost'`
  - Operating Expenses = remaining expense accounts (5200 Discount Allowed, 5300 Extra Expense, and all other 5xxx not in cost-of-production set)
  - Gross Profit = Revenue − Cost of Sales
  - Net Profit = Gross Profit − Operating Expenses
- **Comparison period:** Optional prior-period comparison by passing `compareStartDate` / `compareEndDate`.
- **Service function:** `accountingReportsService.getProfitLoss`

### Day Book

- **Source:** `journal_entry_lines` joined to `journal_entries` for a date range; can be filtered per account or show all accounts.
- **How computed:** Reads individual JE line rows with narration; presents as a chronological journal.
- **Component:** `DayBookReport.tsx`

### Roznamcha / Cash Book

- **Source:** `payments` table — NOT `journal_entry_lines`.
- **How computed:**
  1. `getOpeningBalance` — SUMs `payments.amount` (with direction from `payment_type`) for all payments before the start date, filtered by liquidity bucket (cash/bank/wallet).
  2. `fetchPaymentRows` — fetches `payments` rows in date range, classifies each into cash/bank/wallet using `accounts.type` and `accounts.code` (102x prefix = wallet).
  3. `buildSummaryAndRunning` — computes running balance per row, summary (openingBalance + cashIn − cashOut = closingBalance), and cash split by liquidity type.
- **Reference display enrichment:** Sale payments resolve to `sales.invoice_no`; purchase payments resolve to `purchases.po_no`; expense payments resolve to `expenses.expense_no` (or JE `entry_no` when expense_no not found).
- **Voided payments:** Excluded by default (`voided_at IS NULL`). Can be included via `includeVoidedReversed` flag.
- **Branch filter:** `payments.branch_id = branchId` when branch is selected.
- **Service function:** `roznamchaService.getRoznamcha`
- **Important:** Roznamcha running balance will NOT equal GL cash/bank balance because it counts payments only — it excludes manual journal entries that touch cash/bank accounts directly without a `payments` row.

### Commission Report

- **Source:** `sales` table columns: `commission_amount`, `commission_eligible_amount`, `commission_percent`, `commission_status`, `commission_batch_id`, `salesman_id`, `due_amount`.
- **How computed:** Reads all final sales in the date range with a non-null `commission_amount > 0`. Groups by `salesman_id`, aggregating `commission_amount` totals. Splits into `posted` vs `pending` by `commission_status`. Optionally filters to `fully_paid_only` (where `due_amount = 0`).
- **GL representation:** Batch posting only — commissions are posted to GL only when a Commission Batch is finalised, at which point JEs are created. The report itself reads operational columns.
- **Service function:** `commissionReportService.getCommissionReport`

---

## Reports Date Range Handling

| Report | Date Field Used | Range Semantics | Notes |
|---|---|---|---|
| Trial Balance | `journal_entries.entry_date` | Inclusive start and end (YYYY-MM-DD) | JE lines with `entry_date < start` or `entry_date > end` are excluded |
| Balance Sheet | `journal_entries.entry_date` | Cumulative from `1900-01-01` to `asOfDate` (inclusive) | All historical JEs up to the as-of date |
| Profit & Loss | `journal_entries.entry_date` | Inclusive start and end; optional comparison period | Comparison period is a separate TB pass |
| Day Book | `journal_entries.entry_date` | Inclusive start and end | Per-account or all-accounts |
| Roznamcha | `payments.payment_date` | Inclusive start and end; opening balance from all payments before start | Opening balance query uses `payment_date < dateFrom` (strict less-than) |
| Commission | `sales.invoice_date` | Inclusive start; end uses next-day exclusive (`invoice_date < endExclusive`) | Next-day calculation handles timestamp edge case for full end-day inclusion |
| Dashboard (today) | `sales.invoice_date` / `expenses.expense_date` / `purchases.po_date` | Today only (server-side date at query time) | Branch-filtered via RPC param |
| Dashboard (monthly) | Same date columns | Calendar month: 1st to last day of current month | Month calculated server-side in RPC; client fallback calculates locally |

---

## Branch Filtering

### GL Reports (Trial Balance, P&L, Balance Sheet)

Branch filtering is applied at the `journal_entries.branch_id` level:

```
journalEntryMatchesBranchFilter(jeBranchId, filterBranchId):
  if no filter → include all
  if jeBranchId IS NULL → always include (company-wide openings)
  if jeBranchId = filterBranchId → include
  else → exclude
```

This means company-wide journal entries (opening balances posted without a branch, legacy rows) are always included regardless of branch filter, ensuring the Balance Sheet does not artificially understate equity or assets.

### Roznamcha

Branch filtering applied directly on `payments.branch_id = branchId`. Unlike GL reports, payments without a branch_id are NOT automatically included when a branch filter is active.

### Dashboard RPC

Branch filter is passed as `p_branch_id` to both `get_dashboard_metrics` and `get_financial_dashboard_metrics`. The RPC enforces its own branch logic (implementation in DB). If `branchId` is `'all'`, `'default'`, or fails UUID format validation, it is sent as `null` (company-wide).

### Commission Report

Branch filter applied as `sales.branch_id = branchId` when `branchId` is not `'all'`.

---

## Source of Truth vs Display Shortcut

| Metric | GL Source of Truth | Dashboard Display Source | Shortcut Accepted? | Why |
|---|---|---|---|---|
| Revenue (formal reports) | `journal_entry_lines` Cr on accounts type `revenue` (e.g. 4100) | — | N/A — reports always use GL | P&L and TB are always GL |
| Revenue (dashboard KPI) | `journal_entry_lines` Cr 4100 | `sales.total` WHERE `status='final'` | **Yes — documented shortcut** | Sub-1s load requirement; operational total is close enough for dashboard display; trade-off documented |
| Expenses (formal) | `journal_entry_lines` Dr on 5xxx accounts | — | N/A | P&L always GL |
| Expenses (dashboard) | `journal_entry_lines` Dr 5xxx | `expenses.amount` WHERE `status='paid'` + `purchases.total` | **Yes — documented shortcut** | Same speed rationale |
| Cash Balance | `journal_entry_lines` net Dr on account code 1000 | GL via `getAccountBalancesFromJournal` | **No shortcut — GL is used on dashboard** | Cash balance must be accurate; GL sourced even in dashboard |
| Bank Balance | `journal_entry_lines` net Dr on account code 1010 | GL via `getAccountBalancesFromJournal` | **No shortcut — GL is used on dashboard** | Same |
| AR Balance (formal) | `journal_entry_lines` net Dr on account 1100 + subledger children | — | N/A | TB/BS always GL |
| AR Balance (dashboard) | `journal_entry_lines` net on 1100 | `sales.due_amount` WHERE `due_amount > 0` | **Yes — operational shortcut** | RPC uses operational `due_amount` for speed; will not match GL 1100 |
| AP Balance (dashboard) | `journal_entry_lines` net on 2000 | `purchases.due_amount` WHERE `due_amount > 0` | **Yes — operational shortcut** | Same |
| Roznamcha running balance | `journal_entry_lines` net Dr on 1000/1010 (GL cash position) | `payments` table running sum | **Yes — by design** | Roznamcha is a cash movement log, not a GL position. Explicitly documented. |
| Commission total | GL JE on commission expense account (when batch posted) | `sales.commission_amount` column | **Yes — operational** | Commission report reads operational; GL only updated on batch post |
| Stock quantity | `stock_movements` SUM | `products.current_stock` or `inventory_balance` (may be stale) | **Shortcut risk** | See gaps section below |

---

## Known Gaps / Discrepancies

### 1. Dashboard AR/AP vs GL AR/AP

- Dashboard `receivables` = SUM of `sales.due_amount` for all open sales.
- GL AR (account 1100) = net debit on `journal_entry_lines` for account 1100 and all subledger children.
- These will diverge when:
  - Manual receipts are applied against customers without a linked sale (allocated via `manual_receipt` JE, not clearing `sales.due_amount`)
  - Opening AR balances were posted directly to the 1100 subledger
  - Sale returns reduce GL AR but `due_amount` on the original sale is not zeroed correctly
- **Reconciliation:** Use the AR/AP Reconciliation Center (`/ar-ap-reconciliation-center`) which runs `getArApGlSnapshot` vs operational totals.

### 2. Roznamcha vs GL Cash Balance

- Roznamcha closing balance = opening (from payments before period) + period cash IN − period cash OUT.
- GL cash balance = net Dr on account 1000 from `journal_entry_lines` (all time).
- These diverge when manual journal entries debit/credit cash/bank accounts directly without creating a `payments` row.
- Per `AddEntryV2` rule: cash-touching manual entries *should* create a payments row first, but legacy entries or corrections may not have one.

### 3. Dashboard Revenue vs GL Revenue

- Dashboard `monthly_revenue` uses `sales.total` (operational).
- GL revenue uses Cr on account 4100 (revenue) from posted JEs.
- Divergence sources: unposted sales (finalized but GL not yet created), sales with accounting errors, or adjustments posted manually to 4100.
- Dashboard is a known accepted shortcut — do not use it for statutory reporting.

### 4. Low Stock Alert

- `low_stock_items` sourced from `productService.getLowStockProducts`, which may read `products.current_stock` or `inventory_balance`.
- If `inventory_balance` table is stale (not updated after stock movements), the alert threshold comparison is unreliable.
- Canonical stock quantity is `SUM(stock_movements.quantity_change)` per product.

### 5. P&L Cost of Sales Classification

- Cost of Sales is determined by `accounts.code` matching the set `{5000, 5010, 5100, 5110}` or `accounts.type` containing `'cogs'` / `'cost'`.
- Accounts 5200 (Discount Allowed) and 5300 (Extra Expense) are classified as operating expenses, not cost of sales.
- If custom expense accounts are added with codes outside this set but logically belong in COGS, they will appear in Operating Expenses on the P&L.

### 6. Commission — GL Not Updated Until Batch Post

- The Commission Report shows `commission_amount` from `sales` table. This is the amount *earned* but not yet posted.
- GL commission expense account is only debited when a commission batch is finalised and its JEs are created.
- Report totals showing "pending" commissions represent a future liability not yet reflected in any GL report.

---

## Recommended Standard

1. **GL reports (Trial Balance, P&L, Balance Sheet) must always read from `journal_entries` + `journal_entry_lines` only.** Never use operational table totals as substitutes in these reports.

2. **Dashboard KPI metrics may use operational table shortcuts (`sales.total`, `expenses.amount`, `purchases.total`) for speed**, provided the metric is labelled appropriately and not used for statutory or audit purposes.

3. **Cash and bank balances on the dashboard must remain GL-sourced** (via `getAccountBalancesFromJournal`), even at the cost of a slightly longer load time. These are the most operationally critical balances.

4. **AR and AP on the dashboard are operational shortcuts.** Any discrepancy from GL should be investigated in the Reconciliation Center, not resolved by patching `sales.due_amount`.

5. **Roznamcha is not a substitute for the GL cash position.** It is a payment movement log. For GL-accurate cash, use Trial Balance account 1000.

6. **Commission report is operational.** For GL commission expense, use the P&L report after batch posting.

7. **All new report features must call `assertGlTruthQueryTable`** at the top of any function that reads GL data, to prevent accidental fallback to deprecated subledger tables.
