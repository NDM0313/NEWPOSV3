# ERP Date + Time Display Polish

**Date:** 2026-03-14  
**Scope:** Local UI polish; two-line date/time in reports and statements.

---

## Requirement

Wherever date + time is shown in reports, lists, and statements:
- **First row:** date (business format from company settings)
- **Second row:** time (smaller font, lighter/muted color, visually secondary, italic)

Formatting remains driven by business timezone and date format settings.

---

## Implementation

### 1. `formatTime` utility

- **File:** `src/app/utils/formatDate.ts`
- Added `formatTime(date, timeFormat, timezone)` for time-only display using company settings.
- `useFormatDate` hook now exposes `formatTime` in addition to `formatDate` and `formatDateTime`.

### 2. Reusable `DateTimeDisplay` component

- **File:** `src/app/components/ui/DateTimeDisplay.tsx`
- **Props:** `date` (Date | string | number), optional `className`, optional `dateOnly` (single-line date when true).
- **Behavior:** Uses `useFormatDate()`; line 1 = date, line 2 = time (smaller, muted, italic). When `dateOnly` is true, shows only the date line.
- **Styling:** Date = `text-gray-300 text-sm`; time = `text-xs text-gray-500 font-normal italic mt-0.5`.

### 3. Where two-line date/time is used

| Location | Change |
|----------|--------|
| **Day Book** (`DayBookReport.tsx`) | "Date & Time" column uses `<DateTimeDisplay date={e.createdAt} />`. Entries store `createdAt: Date` for display. Export still uses single `dateTime` string. |
| **Roznamcha** (`RoznamchaReport.tsx`) | "Date & Time" column uses `<DateTimeDisplay date={...} />` when row has both `r.date` and `r.time`; otherwise falls back to `rowDateTime(r)`. |
| **UnifiedLedgerView** (summary, detailed, statement) | Replaced `formatDateTime(entry.date)` / `formatDate(entry.date)` with `<DateTimeDisplay date={entry.date} />` in summary, detailed table, and Account Statement table. |
| **Commission Report** (`CommissionReportPage.tsx`) | Date column uses `<DateTimeDisplay date={...} dateOnly />` for invoice date. |

### 4. Export / CSV

- Day Book and Roznamcha exports still use a single date+time string (e.g. `e.dateTime`, `rowDateTime(r)`) for the "Date & Time" column so CSV/Excel remain single-cell.

---

## Files changed

- `src/app/utils/formatDate.ts` – added `formatTime`.
- `src/app/hooks/useFormatDate.ts` – export `formatTime`.
- `src/app/components/ui/DateTimeDisplay.tsx` – new component.
- `src/app/components/reports/DayBookReport.tsx` – use `DateTimeDisplay`; add `createdAt` to entry type.
- `src/app/components/reports/RoznamchaReport.tsx` – use `DateTimeDisplay` for rows with date+time.
- `src/app/components/shared/UnifiedLedgerView.tsx` – use `DateTimeDisplay` for all entry date displays; import component.
- `src/app/components/reports/CommissionReportPage.tsx` – use `DateTimeDisplay` with `dateOnly` for invoice date.

---

## Rollback

- Revert the above files.
- Remove `formatTime` from `formatDate.ts` and `useFormatDate.ts` if no longer needed elsewhere.
- Restore previous single-line date or date+time strings in Day Book, Roznamcha, and UnifiedLedgerView.
