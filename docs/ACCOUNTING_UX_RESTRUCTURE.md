# Accounting Module UX Restructure

This document describes the navigation and UX changes applied to the Accounting and Reports modules (Accounting Module UX Refactor and Navigation Fix), including the follow-up adjustments: restore Financial tab in Reports, and move/rename Accounts report to Accounting as **Account Statements**.

---

## 1. Summary

- **Roznamcha**, **Journal Day Book** were moved from the **Reports** module into the **Accounting** module.
- The **Transactions** tab was replaced by **Journal Entries** and **Day Book**; both use the same **TransactionDetailModal** when a row/voucher is clicked.
- **Reports** module contains: **Overview**, **Sales**, **Purchases**, **Expenses**, and **Financial** (Trial Balance, P&L, Balance Sheet, Sales Profit, Inventory Valuation).
- The **Accounts** report (account-wise statements/ledger) was moved from Reports to the Accounting module and renamed **Account Statements**; it displays account-wise ledger/statement reports.
- **Accounting** module no longer has a “Reports” tab; financial reports (Trial Balance, P&L, etc.) live under **Reports → Financial**. Accounting has **Account Statements** for account-wise ledger only.

---

## 2. Accounting Module Structure (Final)

| Tab | Description |
|-----|-------------|
| **Journal Entries** | List of all journal entries. Click reference → opens TransactionDetailModal. "Add Entry" button here. |
| **Day Book** | Journal Day Book (line-by-line). Voucher numbers clickable → open TransactionDetailModal. |
| **Roznamcha** | Daily Cash Book (Pakistan/India style). |
| **Accounts** | Chart of Accounts (Operational / Professional view). |
| **Ledger** | Dropdown: Customer Ledger, Supplier Ledger, User Ledger, Worker Ledger. |
| **Receivables** | Receivables summary and list. |
| **Payables** | Payables summary and list. |
| **Deposits** | (When Rental module enabled.) |
| **Studio Costs** | (When Studio module enabled.) |
| **Account Statements** | Account-wise ledger / statement by date range (AccountLedgerReportPage). Select account, view entries, export PDF/Excel. |

---

## 3. Reports Module Structure (Final)

| Tab | Description |
|-----|-------------|
| **Overview** | Metrics, monthly trend, sales by status, expenses by category, financial summary. |
| **Sales** | Sales metrics, charts, sales list. |
| **Purchases** | Purchase metrics, monthly purchases, purchases list. |
| **Expenses** | Expense metrics, by category, monthly, expenses list. |
| **Financial** | Financial reports: **Trial Balance**, **Profit & Loss**, **Balance Sheet**, **Sales Profit**, **Inventory Valuation** (sub-tabs). |

---

## 4. Files Modified

### 4.1 `src/app/components/accounting/AccountingDashboard.tsx`
- **Tabs:** `journal_entries`, `daybook`, `roznamcha`, `accounts`, `ledger`, `receivables`, `payables`, `deposits`, `studio`, **`account_statements`** (replaces former **Reports** tab).
- **Tab label:** "Account Statements" (replaces "Reports").
- **Account Statements tab:** Shows only **AccountLedgerReportPage** (account-wise ledger by date range). No Trial Balance, P&L, Balance Sheet, Sales Profit, Inventory Valuation here (those are in Reports → Financial).
- **Imports:** `DayBookReport`, `RoznamchaReport`, `AccountLedgerReportPage`, `BookMarked`. Removed: `TrialBalancePage`, `ProfitLossPage`, `BalanceSheetPage`, `SalesProfitPage`, `InventoryValuationPage`.
- **State:** `reportStartDate`, `reportEndDate` kept for Account Statements; `accountingReportType` removed.

### 4.2 `src/app/components/reports/DayBookReport.tsx`
- **Prop:** `onVoucherClick?: (voucher: string) => void` – when provided, voucher cell is clickable and opens TransactionDetailModal from Accounting.

### 4.3 `src/app/components/reports/ReportsDashboardEnhanced.tsx`
- **Report types:** `'overview' | 'sales' | 'purchases' | 'expenses' | 'financial'`.
- **Financial tab:** Restored. Contains sub-tabs: Trial Balance, Profit & Loss, Balance Sheet, Sales Profit, Inventory Valuation. Uses `TrialBalancePage`, `ProfitLossPage`, `BalanceSheetPage`, `SalesProfitPage`, `InventoryValuationPage`.
- **State:** `financialReportType` for Financial sub-tab selection.
- **Imports:** `TrialBalancePage`, `ProfitLossPage`, `BalanceSheetPage`, `SalesProfitPage`, `InventoryValuationPage`.
- **getExportData:** Case `'financial'` restored for export.

---

## 5. Components Created

- **None.** All behaviour uses existing components. **TransactionDetailModal** is reused for Journal Entries and Day Book. **AccountLedgerReportPage** is used only in Accounting → Account Statements. Financial report pages are used only in Reports → Financial.

---

## 6. Navigation Summary

- **Sidebar:** Unchanged. "Accounting" and "Reports" open Accounting view and Reports view respectively.
- **Accounting:** Journal Entries | Day Book | Roznamcha | Accounts | Ledger | Receivables | Payables | [Deposits] | Studio Costs | **Account Statements**.
- **Reports:** Overview | Sales | Purchases | Expenses | **Financial** (with Trial Balance, P&L, Balance Sheet, Sales Profit, Inventory Valuation).

---

## 7. Pages / Tabs Removed or Moved

- **Transactions** (Accounting): Removed; replaced by Journal Entries and Day Book.
- **Reports** tab (Accounting): Replaced by **Account Statements** (account-wise ledger only). Financial reports (Trial Balance, P&L, etc.) moved to **Reports → Financial**.
- **Accounts** report (from Reports): Moved to Accounting and renamed **Account Statements** (same AccountLedgerReportPage).

---

## 8. Transaction Detail Behaviour

- **Journal Entries:** Row/reference click sets `transactionReference` → **TransactionDetailModal** opens.
- **Day Book:** Voucher button calls `onVoucherClick(voucher)` → same **TransactionDetailModal** with that voucher (entry_no).

No accounting logic, database schema, or RLS was changed; only UI structure and tab placement were adjusted.

---

## 9. Global Branch Visibility Rule (ERP-wide)

A single rule applies across the whole ERP for branch selection:

| Branch count | Behaviour |
|-------------|-----------|
| **Single branch** (`branches.length ≤ 1`) | Branch selector is **hidden**. System uses the user’s default branch automatically. No dropdown. |
| **Multiple branches** (`branches.length > 1`) | Branch selector is **visible**. Dropdown shows **All Branches** plus each branch (e.g. Main Branch, Lahore Branch). User selection filters data by `branch_id`. |

### Implementation

- **TopHeader:** Branch/location dropdown is shown only when `branches.length > 1`. When a single branch exists, the dropdown is not rendered and the default branch is used.
- **BranchSelector component** (`src/app/components/layout/BranchSelector.tsx`): Reusable component that returns `null` when `branches.length <= 1`, and otherwise shows a dropdown (header or inline variant). Uses context `branchId` / `setBranchId` when not passed as props. Optional “All Branches” option for admins.
- **Branch list cache:** `branchService.getBranchesCached(companyId)` caches the branch list in memory (5‑minute TTL). Cache is cleared on sign-out via `branchService.clearBranchCache()`.
- **Filter logic:** When a specific branch is selected, all relevant queries use `branch_id`. When “All Branches” is selected, `branch_id` is not applied (or passed as `null`).

### Where it applies

- **Header:** Global branch selector in TopHeader (hidden when single branch).
- **Reports:** Reports dashboard filter bar (Date Range, Branch, Export) and Roznamcha filters use BranchSelector / context `branchId`.
- **Accounting, Sales, Purchases, Inventory, Studio:** All use `branchId` from SupabaseContext for data; header selector drives the value. BranchSelector can be added to any page filter bar that has Date Range + Export for consistency.

### Future multi-company

When multi-company support is added, the hierarchy will be: **Company → Branch →** (Users, Sales, Inventory, etc.). The current branch logic remains valid at the branch level.
