# Next Development Phase — Roadmap

Suggested focus areas after finalizing the courier-ledger accounting system.

---

## 1. Financial Reporting Improvements

- **Profit & Loss:** Ensure all revenue/expense account types (Sales Revenue, Shipping Income, Cost of Production, Shipping Expense, Discount Allowed, Extra Expense) are clearly grouped and labeled; add comparison period (e.g. prior month/quarter).
- **Balance Sheet:** Add subtotals by account group; support as-of-date picker and export (PDF/Excel).
- **Trial Balance:** Add export and drill-down from account to journal lines.
- **Custom date ranges** and **branch filter** for all reports.
- **Scheduled report runs** (e.g. monthly P&L email).

---

## 2. Mobile ERP UI Improvements

- Responsive layout for Accounting (Courier Reports, Pay Courier, Journal list).
- Touch-friendly tables: larger tap targets, swipe actions where appropriate.
- Simplified navigation and bottom tabs for key modules (Sales, Inventory, Accounting).
- Offline-capable views for read-only reports (cache last fetched data).
- Push or in-app notifications for payment reminders (e.g. courier balance due).

---

## 3. Barcode Scanning Integration

- Product lookup by barcode in POS and Inventory (scan to add to sale or adjust stock).
- Shipment label scan to update tracking or status (e.g. “Dispatched”).
- Optional: barcode generation for products and orders (code128/QR).
- Integration with existing product/inventory and shipment services.

---

## 4. Performance Optimization Tasks

- **Database:** Review and add indexes for heavy report queries (Trial Balance, P&L, courier_ledger by date range); consider materialized views for large companies.
- **API:** Selective column fetch (already started for courier/shipment ledger); pagination for journal entries and ledger views; response caching where appropriate.
- **Frontend:** Lazy load Accounting tabs (e.g. Courier Reports, Account Statements); virtualize long tables; defer non-critical dashboard widgets.
- **Supabase:** Tune RLS and connection pooling; monitor slow queries.

---

## 5. Backup Automation

- Scheduled database backups (daily/weekly) with retention policy.
- One-click restore or point-in-time recovery documentation.
- Optional: backup of uploaded files (invoices, shipment documents) to secondary storage.
- Test restore procedure periodically.

---

## 6. Security Improvements

- **Auth:** Enforce strong password policy; optional 2FA for admin/sensitive roles.
- **RLS:** Audit all tables for correct `company_id` / `branch_id` isolation; restrict access to accounting and payments by role.
- **Audit log:** Log sensitive actions (journal entry create/delete, courier payment, role changes) with user and timestamp.
- **Secrets:** Ensure no API keys or DB credentials in frontend; use env and Supabase Vault where applicable.

---

## Priority Order (Suggested)

1. Financial reporting polish and exports (P&L, Balance Sheet, Trial Balance).  
2. Performance: indexes, pagination, lazy loading.  
3. Mobile UI improvements for core flows.  
4. Backup automation and security audit.  
5. Barcode scanning (if required by operations).
