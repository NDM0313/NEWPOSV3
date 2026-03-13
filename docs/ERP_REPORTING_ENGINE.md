# ERP Reporting Engine

**Project:** NEW POSV3 ERP  
**Date:** 2026-03-13  
**Phase:** 3 — Reporting Engine (Master Roadmap)

---

## 1. Goal

Implement **complete financial and operational reporting** from journal_entries, stock_movements, sales, purchases.

---

## 2. Financial reports (current)

| Report          | Status | Data source | Location |
|-----------------|--------|-------------|----------|
| Trial Balance   | Done   | journal_entries + journal_entry_lines + accounts | accountingReportsService.getTrialBalance, TrialBalancePage |
| Profit & Loss   | Done   | Same (revenue/expense accounts) | getProfitLoss, ProfitLossPage |
| Balance Sheet   | Done   | Same (asset/liability/equity) | getBalanceSheet, BalanceSheetPage |
| General Ledger  | Done   | Account ledger by account_id + date range | AccountLedgerView, ledger APIs |
| Cash Flow       | Done   | getCashFlowStatement (operating, investing, financing) | accountingReportsService.getCashFlowStatement |

---

## 3. Operational reports (current)

| Report            | Status | Data source | Location |
|-------------------|--------|-------------|----------|
| Sales Report      | Done   | sales, sale_items | ReportsDashboard, sales APIs |
| Purchase Report   | Done   | purchases, purchase_items | Purchase reports, purchase APIs |
| Inventory Report  | Done   | stock_movements, products | Inventory reports, get_inventory_valuation |
| Stock Valuation   | Done   | stock_movements (quantity × cost) | accountingReportsService, get_inventory_valuation |
| Customer Ledger   | Done   | journal_entries (reference_type sale/payment), payments | CustomerLedgerPage, customerLedgerAPI |
| Supplier Ledger   | Done   | Same pattern for suppliers | GenericLedgerView, ledgerDataAdapters |

---

## 4. Data sources (as per Master)

- journal_entries  
- stock_movements  
- sales  
- purchases  

All are in use by the above reports.

---

## 5. Outputs

- This document: `docs/ERP_REPORTING_ENGINE.md`
- No new migrations required for Phase 3; reporting engine is implemented and documented.

---

## 6. Optional enhancements

- Export (PDF/Excel) for all reports: partially present; extend as needed.
- Date range and branch filters: present on key reports.
- Mobile: Accounting module links to Trial Balance, P&L, Balance Sheet, Cash Flow; ensure API parity with web.
