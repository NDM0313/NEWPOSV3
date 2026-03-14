# ERP Salesman Commission Architecture

**Date:** 2026-03-14  
**Scope:** Local; scalable commission model with sale-level capture and period reporting.

---

## Business requirement

- Salesman may be: **fixed salary**, **commission only**, or **fixed salary + commission**.
- Admin selects salesman on sale; that sale counts toward the salesman’s commission.
- Commission must be **reportable by period**.
- Prefer **summarized commission calculation** and **period-based commission statement** instead of only huge transaction-by-transaction ledger growth.

---

## Design: sale-level capture + period report

1. **Sale-level raw data (source of truth)**  
   Each final sale stores:
   - `salesman_id` – user (salesperson) assigned for commission.
   - `commission_amount` – commission for that sale (saved at finalize).
   - `commission_eligible_amount` – optional base amount (e.g. subtotal) used for calculation.

2. **Where it lives**  
   - **Table:** `sales`  
   - **Columns:** `salesman_id` (UUID), `commission_amount` (DECIMAL), `commission_eligible_amount` (DECIMAL, optional).  
   - **Migration:** `migrations/sales_salesman_commission_columns.sql` (adds columns and indexes if not present).

3. **Compensation types (master data)**  
   - Stored at user/employee level: fixed salary, commission rate, “can be assigned as salesman” (e.g. `users` / employees with `commission_rate`, `basic_salary`).  
   - No change to that in this pass; the **sale** only stores who was assigned and how much commission was recorded for that invoice.

4. **Commission-eligible amount**  
   - Commission is calculated on the sale (e.g. percentage of subtotal or fixed amount) in the **UI** (SaleForm).  
   - The result is saved as `commission_amount` on the sale.  
   - **Extra expenses** (stitching, shipping, etc.) are **excluded** from commission unless the business explicitly includes them in the formula in the form; the form currently uses subtotal (or fixed) for commission.

5. **Period-based summary**  
   - **Commission report** (Reports → Commission) aggregates by **period** (global date range):  
     - For each salesman: total commission, number of sales, total sales amount.  
     - Detail table: invoice, date, customer, total, commission per sale.  
   - Data source: `sales` with `status = 'final'` and `invoice_date` in range; filter by `commission_amount > 0` or `salesman_id` not null.  
   - **No** dependency on per-sale ledger rows for this report; it reads only `sales`.

6. **Ledger / journal (existing behavior)**  
   - Existing flow remains: when a sale is finalized with commission, the app can still call `create_commission_journal_entry` and optionally sync to the user’s ledger for that sale (per-sale ledger entry).  
   - **Reporting and period summary** are based on `sales` (sale-level capture), not on scanning ledger lines.  
   - Future option: add a “post period summary only” mode (one journal/ledger entry per salesman per period) instead of one per sale; not implemented in this pass.

---

## Data flow

- **Create sale:** SaleForm sends `salesmanId`, `commissionAmount` (and optionally commission type/value). SalesContext builds `supabaseSale` with `salesman_id`, `commission_amount`, `commission_eligible_amount` (e.g. subtotal) and calls `saleService.createSale(supabaseSale, ...)`. DB insert includes these columns.
- **Update sale:** When the user edits a sale and changes salesman/commission, SalesContext sets `salesman_id`, `commission_amount` (and optionally `commission_eligible_amount`) in `supabaseUpdates` and calls `saleService.updateSale(id, supabaseUpdates)`.
- **Commission report:** `getCommissionReport(companyId, startDate, endDate)` queries `sales` for the range, groups by `salesman_id`, sums `commission_amount` and totals; resolves names from `users`. No ledger or journal tables are read for this report.

---

## Files changed

- `migrations/sales_salesman_commission_columns.sql` – add `salesman_id`, `commission_amount`, `commission_eligible_amount` to `sales`; indexes for report.
- `src/app/services/saleService.ts` – `Sale` interface extended with `salesman_id`, `commission_amount`, `commission_eligible_amount`.
- `src/app/context/SalesContext.tsx` – `supabaseSale` on create includes `salesman_id`, `commission_amount`, `commission_eligible_amount`; `updateSale` persists them; `Sale` and `convertFromSupabaseSale` include `salesmanId`, `commissionAmount`.
- `src/app/services/commissionReportService.ts` – new; `getCommissionReport(companyId, startDate, endDate)`.
- `src/app/components/reports/CommissionReportPage.tsx` – new; period commission summary + detail table using global date range.
- `src/app/components/reports/ReportsDashboardEnhanced.tsx` – add “Commission” tab and render `CommissionReportPage` with global start/end dates.

---

## Rollback

- Revert the listed files.
- Optionally drop added columns:  
  `ALTER TABLE sales DROP COLUMN IF EXISTS salesman_id;`  
  `ALTER TABLE sales DROP COLUMN IF EXISTS commission_amount;`  
  `ALTER TABLE sales DROP COLUMN IF EXISTS commission_eligible_amount;`  
  (Only if nothing else relies on them.)
