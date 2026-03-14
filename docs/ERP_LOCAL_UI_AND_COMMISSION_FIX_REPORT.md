# ERP Local UI Polish + Salesman Commission Architecture – Fix Report

**Date:** 2026-03-14  
**Environment:** Local only (no VPS/deployment).  
**Goal:** Date+time visual polish, UI theme normalization, and scalable salesman commission model with period-based report.

---

## Summary

| Issue | Root cause | Fix |
|-------|------------|-----|
| **1. Date + time visual** | Single-line date+time; time not visually secondary | Two-line display: date on first line, time on second (smaller, muted, italic). Reusable `DateTimeDisplay` + `formatTime`; applied in Day Book, Roznamcha, UnifiedLedgerView, Commission report. |
| **2. UI graphics/borders** | Inconsistent card/border/background after prior changes | Documented standard (e.g. `bg-gray-900/50 border border-gray-800 rounded-xl`). Existing reports already aligned; no broad code change. |
| **3. Commission architecture** | Per-sale ledger growth; no single period report | Sale-level capture on `sales` (salesman_id, commission_amount, commission_eligible_amount); Commission report by period from `sales`; optional journal/ledger unchanged. |

---

## Files changed

| File | Change |
|------|--------|
| `src/app/utils/formatDate.ts` | Added `formatTime(date, timeFormat, timezone)`. |
| `src/app/hooks/useFormatDate.ts` | Export `formatTime`. |
| `src/app/components/ui/DateTimeDisplay.tsx` | **New** – two-line date + time component. |
| `src/app/components/reports/DayBookReport.tsx` | Use `DateTimeDisplay`; add `createdAt` to entry; import component. |
| `src/app/components/reports/RoznamchaReport.tsx` | Use `DateTimeDisplay` for date+time column. |
| `src/app/components/shared/UnifiedLedgerView.tsx` | Use `DateTimeDisplay` for summary, detailed, and statement date cells. |
| `migrations/sales_salesman_commission_columns.sql` | **New** – add `salesman_id`, `commission_amount`, `commission_eligible_amount` to `sales`; indexes. |
| `src/app/services/saleService.ts` | Extend `Sale` with `salesman_id`, `commission_amount`, `commission_eligible_amount`. |
| `src/app/context/SalesContext.tsx` | Persist salesman/commission on create and update; add to `Sale` and `convertFromSupabaseSale`. |
| `src/app/services/commissionReportService.ts` | **New** – `getCommissionReport(companyId, startDate, endDate)`. |
| `src/app/components/reports/CommissionReportPage.tsx` | **New** – Commission tab content (summary cards + detail table). |
| `src/app/components/reports/ReportsDashboardEnhanced.tsx` | Add Commission tab and render `CommissionReportPage`. |

---

## Migration added

- **Yes:** `migrations/sales_salesman_commission_columns.sql`
  - `ALTER TABLE sales ADD COLUMN IF NOT EXISTS salesman_id UUID;`
  - `ALTER TABLE sales ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(15,2) DEFAULT 0;`
  - `ALTER TABLE sales ADD COLUMN IF NOT EXISTS commission_eligible_amount DECIMAL(15,2);`
  - Indexes for report queries.

Run on local DB when ready (and on VPS when deploying).

---

## Date/time styling standardization

- **Utility:** `formatTime()` in `src/app/utils/formatDate.ts`; exposed via `useFormatDate().formatTime`.
- **Component:** `DateTimeDisplay` in `src/app/components/ui/DateTimeDisplay.tsx` – first line date, second line time (smaller, muted, italic).
- **Used in:** Day Book (Date & Time column), Roznamcha (Date & Time column), UnifiedLedgerView (summary, detailed table, Account Statement table), Commission report (invoice date with `dateOnly`).

---

## UI theme inconsistencies addressed

- **Standard documented** in `docs/ERP_UI_THEME_NORMALIZATION.md`: card `bg-gray-900/50` or `bg-gray-950/50`, `border border-gray-800`, `rounded-xl`; table headers and row hover pattern.
- **No bulk re-style:** Existing report/accounting screens already follow this; Commission report uses the same Card styling. Any future odd background/border on click can be fixed by aligning to that doc.

---

## Commission design (final model)

- **Master:** Salesman = user assignable on sale; compensation type/rate can live on user/employee (e.g. existing `commission_rate`, `basic_salary`). Not changed in this pass.
- **Capture:** Each final sale stores `salesman_id`, `commission_amount`, and optionally `commission_eligible_amount` on `sales`.
- **Calculation:** Done in SaleForm (percentage of subtotal or fixed); result saved as `commission_amount`. Extra expenses excluded unless form logic is extended.
- **Reporting:** Commission report (Reports → Commission) aggregates by period (global date range) from `sales` only: total commission and sale count per salesman, plus detail table (invoice, date, customer, total, commission). No ledger read.
- **Ledger:** Existing `create_commission_journal_entry` and user-ledger sync remain optional; report does not depend on them.

---

## How commission is calculated and reported

- **On sale:** User picks salesman and commission type/value in SaleForm; form computes amount (e.g. subtotal × rate or fixed) and sends `commissionAmount` + `salesmanId` with the sale. Context saves them to `sales`.
- **Report:** User picks period (global date filter), opens Reports → Commission. Backend queries `sales` for that period and `status = 'final'`, groups by `salesman_id`, sums `commission_amount` and `total`, resolves names from `users`. UI shows summary cards and detail table.

---

## Rollback notes

- **Date/time:** Revert `formatDate.ts`, `useFormatDate.ts`, `DateTimeDisplay.tsx`, DayBookReport, RoznamchaReport, UnifiedLedgerView, CommissionReportPage (date display only). Restore previous single-line or raw format.
- **Commission:** Revert SalesContext (create/update and Sale mapping), saleService Sale interface, commissionReportService, CommissionReportPage, ReportsDashboardEnhanced Commission tab. Then run:  
  `ALTER TABLE sales DROP COLUMN IF EXISTS salesman_id;`  
  `ALTER TABLE sales DROP COLUMN IF EXISTS commission_amount;`  
  `ALTER TABLE sales DROP COLUMN IF EXISTS commission_eligible_amount;`  
  (and drop indexes from migration if desired.)
- **UI theme:** Doc-only; no code rollback.

---

## Documentation created/updated

- `docs/ERP_DATETIME_DISPLAY_POLISH.md`
- `docs/ERP_UI_THEME_NORMALIZATION.md`
- `docs/ERP_SALESMAN_COMMISSION_ARCHITECTURE.md`
- `docs/ERP_SALESMAN_COMMISSION_REPORT_FLOW.md`
- `docs/ERP_LOCAL_UI_AND_COMMISSION_FIX_REPORT.md` (this file)

---

## Local verification steps

1. **Date/time:** Open Day Book and Roznamcha; confirm “Date & Time” column shows date on first line and time on second (smaller, italic). Open a ledger → Account Statement; confirm same two-line pattern.
2. **UI:** Open Reports and Accounting; confirm cards and tables use consistent gray borders and backgrounds (no obvious mismatch).
3. **Commission:** Create or edit a sale, select a salesman, set commission (e.g. 5%), finalize. Confirm sale saves. Open Reports → Commission, set period (e.g. Last 30 Days); confirm that sale appears and totals match.
4. **Scalability:** Confirm Commission report loads from `sales` only (no heavy ledger scan); period change only refetches commission data.
