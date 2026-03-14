# Day Book / Roznamcha – Date + Time Display Fix

**Date:** 2026-03-14  
**Scope:** Local ERP; Day Book and Roznamcha show full date and time.

---

## Issue

Day Book and Roznamcha showed only **time** (e.g. “02:30 PM”), not the full **date + time**, and did not consistently use business timezone/date format.

---

## Requirement

- Show full **date and time** in both reports.
- Use the **canonical formatter** from global business settings (timezone + date format).
- Keep sorting and display human-readable.

---

## Changes

### Day Book (DayBookReport)

- **Data:** Each row now has a `dateTime` string (date + time) formatted via `useFormatDate().formatDateTime(createdAt)` in addition to the existing `time` string.
- **Table:** Column header changed from “Time” to “Date & Time”; cell shows `e.dateTime`.
- **Export:** Export headers/rows use “Date & Time” and the same `dateTime` value.
- **Source:** `created_at` from journal entries is passed to `formatDateTime()` so display respects company timezone and date/time format.

### Roznamcha (RoznamchaReport)

- **Data:** Rows already have `date` and `time` from the service. A helper `rowDateTime(r)` builds a single date+time string:
  - If both `r.date` and `r.time` exist, it builds a Date and formats with `formatDateTime()` (business settings).
  - If only date, uses `formatDate()`; if only time, shows time.
- **Table:** Column header changed from “Time” to “Date & Time”; cell shows `rowDateTime(r)`.
- **Export:** Export uses “Date & Time” and `rowDateTime(r)` for each row.

Both use `useFormatDate()` so company timezone and date format (and time format 12h/24h) apply everywhere.

---

## Files changed

- `src/app/components/reports/DayBookReport.tsx` – `useFormatDate`, `dateTime` on entries, “Date & Time” column and export.
- `src/app/components/reports/RoznamchaReport.tsx` – `useFormatDate`, `rowDateTime()`, “Date & Time” column and export.

---

## Rollback

Revert the above two files. Day Book will show time-only again; Roznamcha will show time-only in the first column.
