# ERP Salesman Commission Report Flow

**Date:** 2026-03-14  
**Scope:** How commission is calculated, stored, and reported (local).

---

## 1. Capture at sale (source of truth)

- On **Create** or **Update** sale (when status is final), the UI sends:
  - `salesmanId` – selected salesman (user id) or null.
  - `commissionAmount` – computed in the form (e.g. percentage of subtotal or fixed amount).
- These are stored on the **sale** row:
  - `sales.salesman_id`
  - `sales.commission_amount`
  - `sales.commission_eligible_amount` (e.g. subtotal; optional).
- Commission is **not** derived from ledger; the sale row is the source for reporting.

---

## 2. Calculation (where it happens)

- **SaleForm** computes commission:
  - Type: percentage or fixed.
  - If percentage: `(subtotal * commissionValue) / 100`.
  - If fixed: `commissionValue`.
- Base is **subtotal** (or fixed); extra expenses are not included unless the form is extended to do so.
- Result is sent as `commissionAmount` and stored on the sale.

---

## 3. Period-based commission report

- **Location:** Reports → Commission tab.
- **Date range:** Uses the **global date filter** (same as other reports).
- **Data:** `getCommissionReport(companyId, startDate, endDate)`:
  - Selects from `sales` where `company_id`, `status = 'final'`, `invoice_date` between start and end, and (`commission_amount > 0` or `salesman_id` is not null).
  - Groups by `salesman_id`; sums `commission_amount` and `total`; counts sales.
  - Resolves salesman name from `users` (full_name / email).
- **UI:** Summary cards per salesman (total commission, sale count, total sales amount); table of all commission sales (invoice, date, customer, total, commission).

---

## 4. Optional: journal / ledger (unchanged in this pass)

- Existing behavior remains: when a sale is finalized with commission, the app can still:
  - Call `create_commission_journal_entry` (journal entry for commission expense).
  - Optionally add a line to the user’s ledger for that sale.
- The **Commission report does not read** journal or ledger; it only reads `sales`. So the design is scalable even if ledger grows large.

---

## 5. Summary

- **Capture:** Sale-level (`sales.salesman_id`, `sales.commission_amount`, `sales.commission_eligible_amount`).
- **Calculation:** In the form (percentage of subtotal or fixed); result stored on sale.
- **Report:** Period-based aggregation from `sales`; no dependency on ledger clutter.
- **Flow:** Create/Edit sale → save salesman + commission on sale → Reports → Commission (by period).
