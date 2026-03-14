# ERP Reports – Global Date Filter Alignment

**Date:** 2026-03-14  
**Scope:** Local ERP; reporting uses the same top-bar date selection pattern.

---

## Requirement

The Reporting section (and accounting reports that behave like reports) should use the same global date selection pattern as the rest of the app (today, last7days, last15days, last30days, thisMonth, thisYear, fromStart, customRange), instead of each report having its own date behaviour.

---

## Current behaviour

- **Global filter:** `GlobalFilterContext` + TopHeader date dropdown provide a single date range (and optional branch). Presets: today, last7days, last15days, last30days, last90days, thisWeek, thisMonth, thisYear, fromStart, customRange.
- **Reports Dashboard (main menu Reports):** `ReportsDashboardEnhanced` already calls `setCurrentModule('reports')` and uses `startDate`/`endDate` from `useGlobalFilter()` for all overview/sales/purchases/expenses/financial data. No change needed there.
- **Accounting → Day Book / Roznamcha:** These reports had their own `DateRangePicker`. They now accept optional `globalStartDate` and `globalEndDate`; when provided, they use the global range and hide the local date picker.

---

## Changes made

1. **DayBookReport**
   - New optional props: `globalStartDate?: string | null`, `globalEndDate?: string | null`.
   - When both are set, the report uses this range for the query and shows “Using global date range from top bar”; the local DateRangePicker is hidden.
   - When not set (e.g. when embedded elsewhere without global filter), local date range is used as before.

2. **RoznamchaReport**
   - New optional props: `globalStartDate`, `globalEndDate` (same semantics).
   - When both are set, uses global range and shows “Using global date range from top bar”; local DateRangePicker is hidden.

3. **AccountingDashboard**
   - Reads `startDate` and `endDate` from `useGlobalFilter()` (as `globalStartDate`, `globalEndDate`).
   - Passes them into `DayBookReport` and `RoznamchaReport`.

So when the user is on Accounting → Day Book or Accounting → Roznamcha, the top-bar date selection drives the report range; no second, conflicting date system.

---

## Files changed

- `src/app/components/reports/DayBookReport.tsx` – optional global date props, conditional UI.
- `src/app/components/reports/RoznamchaReport.tsx` – optional global date props, conditional UI.
- `src/app/components/accounting/AccountingDashboard.tsx` – pass global `startDate`/`endDate` into Day Book and Roznamcha.

---

## Design

- Reporting layout and visuals unchanged.
- Date logic reuses `GlobalFilterContext`; no new date state or presets in reports.
- Reports that already use global filter (e.g. ReportsDashboardEnhanced) unchanged.

---

## Rollback

Revert the three files above. Day Book and Roznamcha will again use only their local date picker.
