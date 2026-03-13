# ERP Reporting Alignment

**Date:** 2026-03-13  
**Phase:** Final stabilization — reporting service aligned with canonical sale line table.

---

## Summary

Reporting now uses **sales_items** first (canonical) with **sale_items** as fallback for backward compatibility. This matches the rest of the app (SalesContext, saleService, dashboardService, etc.) and removes the mismatch where reports read only from `sale_items` while writes go to `sales_items`.

---

## Changes

### accountingReportsService.ts

1. **Added** module comment: canonical table = `sales_items`, fallback = `sale_items`.
2. **Added** helper `getSaleLineItems(selectColumns, saleIds)`:
   - Tries `sales_items` first.
   - On error or missing table, falls back to `sale_items`.
   - Returns array of line items for report aggregation.
3. **Updated** four report methods to use `getSaleLineItems` instead of direct `.from('sale_items')`:
   - `getSalesProfit` — per-sale revenue/cost/profit
   - `getProfitByProduct` — profit aggregated by product
   - `getProfitByCategory` — profit aggregated by category
   - `getProfitByCustomer` — profit aggregated by customer

All four now read from **sales_items** first, then **sale_items** only when needed (e.g. deployments where `sales_items` does not exist or returns an error).

---

## Compatibility

- **Deployments with both tables:** Reports use `sales_items` (canonical).
- **Deployments with only `sale_items`:** Fallback ensures reports still work.
- No schema or data changes; no breaking changes to report APIs or UI.

---

## Verification

- No other reporting code in this service read from `sale_items` exclusively; the four methods above were the only ones. Inventory valuation and accounting reports (trial balance, P&L, balance sheet, cash flow) use `journal_entries`, `journal_entry_lines`, `accounts`, `stock_movements`, or `sales` headers only — no change.
