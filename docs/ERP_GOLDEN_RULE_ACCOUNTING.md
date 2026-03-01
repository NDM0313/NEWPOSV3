# ERP Golden Rule: Only POSTED / FINAL Transactions Affect Accounting

**Rule:** Only when `status = 'final'` (posted) do transactions affect:
- Dashboard totals
- Report totals and graphs
- Stock movement
- Ledger / journal entries
- Payment recording

Draft and Quotation are **temporary data** — no accounting, stock, or totals impact until posted.

---

## Implementation Summary

### 1. Dashboard totals
- **dashboardService.getSalesByCategory:** Uses `.eq('status', 'final')` only (no quotation/order).
- **Dashboard.tsx:** Metrics (totalSales, totalReceivables) computed from `finalSales` (status === 'final'). Purchases: `finalPurchases` (status === 'final' || 'received').
- **SalesPage summary:** TOTAL SALES / TOTAL PAID / TOTAL DUE and invoice count use `finalSalesForSummary` (status === 'final').
- **ReportsDashboard / ReportsDashboardEnhanced:** Same: only final sales and final/received purchases in metrics and graphs.

### 2. Stock movement
- **SalesContext (create):** Stock movements created only when `newSale.type === 'invoice' && newSale.status === 'final'`.
- **SalesContext (update):** Stock deltas applied only when sale is already final (`isFinalStatus`) and items change.
- **Conversion Draft/Quotation → Final:** When a draft is converted to final (e.g. convertQuotationToInvoice or status update to final), stock and ledger must be triggered once. Current create path is correct; ensure any “post”/“convert to final” flow runs the same stock + ledger logic (or updates status and then runs it once).

### 3. Ledger / journal entries
- **SalesContext (create):** Journal entries (sale, discount, commission, extra expenses, payment) created only when `newSale.type === 'invoice' && newSale.status === 'final'`.
- No journal for draft or quotation.

### 4. Payment
- **canAddPaymentToSale (statusHelpers):** Returns true only when `effective === 'final'` or `effective === 'partially_returned'`. Draft/quotation cannot receive payment.

### 5. Customer ledger / reports
- **customerLedgerApi / saleService:** Where totals or ledger are derived from sales, filters use `.eq('status', 'final')` (e.g. sale_returns already use status = 'final').

---

## Optional: `is_posted` boolean (future)

Some ERPs add an explicit `is_posted boolean DEFAULT false` and only allow accounting impact when `is_posted = true`. Status and posting are then separate. Not required for current implementation; can be added later if you want an extra safeguard.

---

## Validation (Phase 3)

- **No double stock:** Stock movements are created only on (1) create with status final, or (2) update with status final and item deltas. Conversion from draft → final must run stock creation exactly once (same as create path).
- **No duplicate ledger:** Journal entries created only when sale is final; one-time on create or on post.
- **Historical data:** Existing draft/quotation rows correctly excluded from all totals and reports after the above changes.
