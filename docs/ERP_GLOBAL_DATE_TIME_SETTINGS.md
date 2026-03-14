# ERP Global Date/Time Settings

**Date:** 2026-03-14  
**Scope:** Local ERP settings + reporting + dashboard fix pass (local only).

---

## Summary

Two business-level settings control date/time display across the ERP:

1. **Company timezone** – IANA timezone (e.g. `Asia/Karachi`, `UTC`, `Asia/Dubai`).
2. **Date format** – One of `DD/MM/YYYY`, `MM/DD/YYYY`, `YYYY-MM-DD`.

These are stored on the company, loaded with settings, and applied via a single canonical formatting layer.

---

## Where settings are stored

- **Table:** `companies`
- **Columns:** `timezone` (existing), `date_format` (added), `time_format` (added)
- **Migration:** `migrations/companies_date_time_format.sql`  
  - Adds `date_format` and `time_format` if not present. Safe to run multiple times.

---

## Load / save flow

- **Load:** `SettingsContext.loadAllSettings()` reads `companies` and maps `date_format`, `time_format`, `timezone` into `company` state (snake_case from DB).
- **Save:** `SettingsContext.updateCompanySettings()` writes `date_format`, `time_format`, and `timezone` to `companies` when provided in the payload.

---

## Business Settings UI

- **Screen:** Settings → Company (SettingsPageNew).
- **Fields added:**
  - **Company timezone** – Select: Asia/Karachi, UTC, Asia/Dubai, Asia/Riyadh, Europe/London, America/New_York.
  - **Date format** – Select: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD.

Saved values are persisted to `companies` and used on next load.

---

## Canonical formatting

- **Utility:** `src/app/utils/formatDate.ts`
  - `formatDate(date, dateFormat, timezone)` – date only.
  - `formatDateTime(date, dateFormat, timeFormat, timezone)` – date + time (respects 12h/24h).
- **Hook:** `src/app/hooks/useFormatDate.ts`
  - Uses `company.dateFormat`, `company.timeFormat`, `company.timezone` from `useSettings()`.
  - Exposes `formatDate`, `formatDateTime` for the whole app.

Use `useFormatDate()` (or the utils with company settings) for all user-facing date/time display so the app stays consistent.

---

## Where global settings are applied

- Dashboard (dates in metrics/charts where applicable).
- Reports (date columns and labels).
- Accounting (Day Book, Roznamcha, statements).
- Account Statement (UnifiedLedgerView – all date cells).
- Transaction details, ledgers, lists and drawers that show dates.
- Print/export where the same formatting is used (e.g. Day Book/Roznamcha export).

Existing usage of `useFormatDate()` and `formatDate`/`formatDateTime` from `@/app/utils/formatDate.ts` already follows these settings; new date display should use the same hook/utils.

---

## Files changed

- `src/app/context/SettingsContext.tsx` – persist `date_format` and `time_format` in `updateCompanySettings`.
- `src/app/components/settings/SettingsPageNew.tsx` – Timezone and Date format fields in Company section.
- `migrations/companies_date_time_format.sql` – add `date_format` and `time_format` to `companies`.

No change to the canonical formatter or hook logic; they already read from company settings.

---

## Rollback

- Revert the three file changes above.
- Optionally remove columns (only if no other code depends on them):
  - `ALTER TABLE companies DROP COLUMN IF EXISTS date_format;`
  - `ALTER TABLE companies DROP COLUMN IF EXISTS time_format;`
