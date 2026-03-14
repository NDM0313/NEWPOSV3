# ERP Local Settings + Reporting + Dashboard Fix Report

**Date:** 2026-03-14  
**Environment:** Local only (no VPS/deployment in this pass).  
**Goal:** Global business timezone/date format, aligned reporting date filter, Day Book/Roznamcha date+time, Account Statement date format, and correct Dashboard Executive Summary.

---

## Summary

| Issue | Root cause | Fix |
|-------|------------|-----|
| **1. Global timezone + date format** | `date_format`/`time_format` not persisted; not in Company UI | Persist in `updateCompanySettings`; add columns via migration; add Timezone + Date format in Settings → Company |
| **2. Reports global date filter** | Day Book/Roznamcha had only local date picker | Optional `globalStartDate`/`globalEndDate` props; AccountingDashboard passes global range |
| **3. Day Book/Roznamcha time only** | Columns showed time only | Use `useFormatDate().formatDateTime`; show “Date & Time” column |
| **4. Account Statement date format** | Hardcoded `en-GB` / toLocaleDateString | Use `formatDate`/`formatDateTime` from `useFormatDate()` in UnifiedLedgerView |
| **5. Executive Summary wrong data** | RPC result ignored when all zeros; fallback used fixed today/month | Use RPC whenever available; fallback uses global date range |

---

## Files changed

| File | Change |
|------|--------|
| `migrations/companies_date_time_format.sql` | Add `companies.date_format`, `companies.time_format` (IF NOT EXISTS) |
| `src/app/context/SettingsContext.tsx` | Persist `date_format` and `time_format` in `updateCompanySettings` |
| `src/app/components/settings/SettingsPageNew.tsx` | Company section: Timezone and Date format dropdowns |
| `src/app/components/reports/DayBookReport.tsx` | `useFormatDate`; `dateTime` column; optional `globalStartDate`/`globalEndDate`; hide local picker when global used |
| `src/app/components/reports/RoznamchaReport.tsx` | `useFormatDate`; `rowDateTime()`; “Date & Time” column; optional global date props |
| `src/app/components/shared/UnifiedLedgerView.tsx` | All date displays use `formatDate`/`formatDateTime` from `useFormatDate()` |
| `src/app/components/dashboard/Dashboard.tsx` | `displayMetrics = financialMetrics ?? executiveFromContext`; fallback uses global range; remove `hasNonZeroMetrics` |
| `src/app/components/accounting/AccountingDashboard.tsx` | Pass `globalStartDate`/`globalEndDate` from `useGlobalFilter()` to DayBookReport and RoznamchaReport |

---

## Migration

- **Added:** `migrations/companies_date_time_format.sql`
  - `ALTER TABLE companies ADD COLUMN IF NOT EXISTS date_format VARCHAR(20);`
  - `ALTER TABLE companies ADD COLUMN IF NOT EXISTS time_format VARCHAR(10);`
- **When to run:** On local DB (and later on VPS when you deploy). Safe to run multiple times.

---

## Where timezone/date format are stored

- **Table:** `companies`
- **Columns:** `timezone` (existing), `date_format`, `time_format` (new)
- **Context:** `SettingsContext.company` (loaded in `loadAllSettings`, updated in `updateCompanySettings`)
- **Canonical formatting:** `src/app/utils/formatDate.ts` + `src/app/hooks/useFormatDate.ts` (read from `company.dateFormat`, `company.timeFormat`, `company.timezone`)

---

## Parts of the system now using global settings

- **Dashboard** – metrics and any date display use global range; Executive Summary uses RPC or range-aware fallback.
- **Reports** – ReportsDashboardEnhanced already used global filter; Day Book and Roznamcha now accept and use global range when provided.
- **Accounting** – Day Book, Roznamcha, Account Statement (UnifiedLedgerView) use business date/time format and, where wired, global date range.
- **Date/time display** – Any component using `useFormatDate()` (or the formatDate/formatDateTime utils with company settings) follows business timezone and date format.

---

## Executive Summary – root cause and fix

- **Root cause:** Summary showed context-based “today” and “month” when RPC returned all zeros (e.g. no sales in selected range), because `displayMetrics` only used RPC when `hasNonZeroMetrics` was true. Fallback also ignored the selected date range.
- **Fix:** Always use RPC result when present (`financialMetrics ?? executiveFromContext`). Fallback recomputed to use global `startDate`/`endDate` so period totals and trends match the selected range. Removed `hasNonZeroMetrics` and updated `displayMetricsWithCashBank` accordingly.

---

## Local verification steps

1. **Business Settings**
   - Open Settings → Company.
   - Change **Company timezone** (e.g. to UTC or Asia/Dubai); save.
   - Change **Date format** (e.g. to MM/DD/YYYY); save.
   - Reload; confirm values persist.

2. **Dashboard**
   - Set global date range (e.g. Last 7 Days).
   - Confirm Executive Summary numbers match the selected period (and RPC or range-aware fallback).
   - Change range; confirm numbers update.

3. **Reports**
   - Open main Reports; confirm date filter in top bar drives data.
   - Open Accounting → Day Book; confirm “Using global date range from top bar” when global range is used, and table shows “Date & Time” with correct format.
   - Same for Accounting → Roznamcha.

4. **Account Statement**
   - Open a customer/supplier/worker ledger → Account Statement tab.
   - Confirm all dates use the format chosen in Company settings (no raw YYYY-MM-DD unless that format is selected).

5. **Day Book / Roznamcha**
   - Confirm “Date & Time” column shows both date and time in business timezone/format.
   - Confirm export (PDF/Excel) uses the same “Date & Time” column.

---

## Rollback notes

- **Settings + migration:** Revert SettingsContext, SettingsPageNew, and the migration file. Optionally drop `companies.date_format` and `companies.time_format` if nothing else uses them.
- **Reports:** Revert DayBookReport, RoznamchaReport, and AccountingDashboard; Day Book/Roznamcha will use only local date picker again.
- **Day Book/Roznamcha datetime:** Revert the same two report components to restore time-only column if needed.
- **Account Statement:** Revert UnifiedLedgerView date formatting to restore previous locale-based display.
- **Dashboard:** Revert Dashboard.tsx to restore `hasNonZeroMetrics` and today/month-only fallback.

---

## Documentation created

- `docs/ERP_GLOBAL_DATE_TIME_SETTINGS.md`
- `docs/ERP_REPORTS_GLOBAL_DATE_FILTER_ALIGNMENT.md`
- `docs/ERP_DAYBOOK_DATETIME_FIX.md`
- `docs/ERP_ACCOUNT_STATEMENT_DATE_FORMAT_FIX.md`
- `docs/ERP_DASHBOARD_EXECUTIVE_SUMMARY_FIX.md`
- `docs/ERP_LOCAL_SETTINGS_REPORTING_DASHBOARD_FIX_REPORT.md` (this file)
