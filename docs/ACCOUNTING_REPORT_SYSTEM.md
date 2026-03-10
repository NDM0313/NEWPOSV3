# Accounting Report System

**Project:** DIN COUTURE ERP (NEWPOSV3)  
**Date:** 2026-03-08  
**Scope:** Full accounting reports engine (Trial Balance, P&L, Balance Sheet, Account Ledger, Sales Profit, Inventory Valuation).

---

## Executive Summary

The ERP Reports section now includes a dedicated **Accounting** tab with six financial reports driven by `journal_entries`, `journal_entry_lines`, `accounts`, `sales`, `sale_items`, `products`, and `stock_movements`. All reports support date/branch filters and PDF/Excel export.

---

## Reports Implemented

| Report | Description | Data source |
|--------|-------------|-------------|
| **Trial Balance** | Sum of debits and credits per account for a date range; total debit vs total credit and difference | `journal_entry_lines` + `journal_entries` + `accounts` |
| **Profit & Loss** | Revenue, Cost of Sales, Gross Profit, Expenses, Net Profit for a period | Derived from Trial Balance (revenue/expense account types) |
| **Balance Sheet** | Assets, Liabilities, Owner Equity as at a date; Assets = Liabilities + Equity | Derived from Trial Balance (asset/liability/equity types) up to as-of date |
| **Account Ledger** | All transactions for a selected account with running balance | `accountingService.getAccountLedger` (existing) |
| **Sales Profit** | Per-sale revenue, cost (from product cost / sale_items), profit and margin % | `sales` + `sale_items` + `products` (cost_price/cost) |
| **Inventory Valuation** | Current stock quantity × unit cost per product as at a date | `stock_movements` (quantity, unit_cost, total_cost) + `products` |

---

## Queries and Logic

### Trial Balance

- Load all active accounts for company; load all `journal_entry_lines` with `journal_entries` (entry_date, company_id, branch_id).
- Filter lines by date range and optional branch; aggregate by account: `SUM(debit)`, `SUM(credit)`, balance = debit − credit.
- Output: rows per account (code, name, type, debit, credit, balance), total debit, total credit, difference (should be 0 if double-entry is balanced).

### Profit & Loss

- Uses Trial Balance result for the same date range.
- **Revenue:** accounts with type revenue/income → amount = credit − debit.
- **Cost of Sales:** expense accounts with type containing “cogs”/“cost” → amount = debit − credit.
- **Expenses:** other expense accounts → amount = debit − credit.
- Gross Profit = Total Revenue − Total Cost of Sales; Net Profit = Gross Profit − Total Expenses.

### Balance Sheet

- Uses Trial Balance from epoch to as-of date (same company/branch).
- **Assets:** asset-type accounts → amount = |balance| (debit nature).
- **Liabilities:** liability-type accounts → amount = |balance| (credit nature).
- **Equity:** equity-type accounts → amount = |balance|.
- Total Assets vs Total Liabilities + Equity; difference reported (should be 0).

### Account Ledger

- Existing `accountingService.getAccountLedger(accountId, companyId, startDate, endDate, branchId)`.
- Shows date, reference, description, debit, credit, running balance per line.

### Sales Profit

- Query `sales` (company, status = final, date range, optional branch/customer); then `sale_items` with `product` (cost_price/cost).
- Revenue = sum of item totals (or sale total); cost = sum(quantity × product cost); profit = revenue − cost; margin % = profit / revenue × 100.

### Inventory Valuation

- Query `stock_movements` (company, optional branch) up to as-of date; group by product: sum(quantity), for cost use total_cost or quantity × unit_cost to get weighted average.
- Join `products` for name, sku; total value = quantity × avg cost per product.

---

## Files Modified / Created

### New files

- `src/app/services/accountingReportsService.ts` — Trial Balance, P&L, Balance Sheet, Sales Profit, Inventory Valuation APIs.
- `src/app/components/reports/TrialBalancePage.tsx`
- `src/app/components/reports/ProfitLossPage.tsx`
- `src/app/components/reports/BalanceSheetPage.tsx`
- `src/app/components/reports/AccountLedgerReportPage.tsx`
- `src/app/components/reports/SalesProfitPage.tsx`
- `src/app/components/reports/InventoryValuationPage.tsx`
- `docs/ACCOUNTING_REPORT_SYSTEM.md` (this file).

### Modified files

- `src/app/components/reports/ReportsDashboardEnhanced.tsx` — Added “Accounting” tab and sub-tabs for the six reports; date range and branch passed to each report; `useSupabase` for `branchId`.
- `migrations/journal_entry_lines_performance_indexes.sql` — Added composite index `idx_journal_entries_company_entry_date` on `journal_entries(company_id, entry_date)` for report date-range queries.

---

## Indexes Used / Created

Existing (from `journal_entry_lines_performance_indexes.sql`):

- `journal_entry_lines`: `account_id`, `journal_entry_id`
- `journal_entries`: `company_id`, `branch_id`, `entry_date`, `reference_type + reference_id`, `(company_id, reference_type)`

Added for accounting reports:

- `journal_entries(company_id, entry_date)` — Trial Balance, P&L, and Balance Sheet date-range filters.

Run the migration on the target database if not already applied:

```bash
# Apply migrations (e.g. via Supabase SQL Editor or deploy script)
# migrations/journal_entry_lines_performance_indexes.sql
```

---

## UI Integration

- **Navigation:** Reports → Accounting (tab) → sub-tabs: Trial Balance, Profit & Loss, Balance Sheet, Account Ledger, Sales Profit, Inventory Valuation.
- **Filters:** Global date range (Last 7/30/90/365 days, All time) applies to all accounting reports; Balance Sheet and Inventory Valuation use the range end date as “as at” date. Branch is passed from `useSupabase().branchId` when available.
- **Export:** Each report page has PDF and Excel buttons; uses `exportUtils.exportToPDF` and `exportToExcel` with report-specific title and table data.

---

## Performance Considerations

- **Trial Balance / P&L / Balance Sheet:** Load all lines for the company (and date range for TB/P&L); aggregation is in-memory. For very large volumes (e.g. millions of lines), consider a DB-side RPC that returns aggregated totals per account.
- **Account Ledger:** Already implemented with date/branch filters; single account at a time.
- **Sales Profit:** Two queries (sales list, then sale_items with products); no N+1.
- **Inventory Valuation:** One query for movements, one for product names; aggregation in-memory. For large product/movement sets, consider an RPC that returns aggregated stock and value per product.
- Reports are designed to load in under 2 seconds for typical company sizes; indexes and limited date ranges keep queries fast.

---

## Validation Notes

- **Trial Balance:** Total Debit and Total Credit should match (difference = 0) when all journal entries are balanced. UI shows the difference if non-zero.
- **P&L:** Revenue and expenses use standard double-entry nature (revenue = credit − debit, expenses = debit − credit).
- **Balance Sheet:** Assets = Liabilities + Equity; difference is shown. Retained earnings / closing to equity may need to be posted for a perfect match.
- No changes were made to journal entry creation, RLS policies, or table drops; all report logic is read-only.

---

## References

- `docs/FINAL_PERFORMANCE_OPTIMIZATION_REPORT.md`
- `docs/STUDIO_PERFORMANCE_OPTIMIZATION_REPORT.md`
- `src/app/services/accountingService.ts` — Account Ledger, journal structure
- `src/app/services/accountService.ts` — Accounts list
- `supabase-extract/migrations/12_accounting_reports.sql` — Reference RPCs (get_profit_loss, get_inventory_valuation) for possible future server-side optimization
