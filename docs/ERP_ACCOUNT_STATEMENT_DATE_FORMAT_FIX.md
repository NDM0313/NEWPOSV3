# Account Statement – Date Format Fix

**Date:** 2026-03-14  
**Scope:** Local ERP; Account Statement uses business date format and timezone.

---

## Issue

Account Statement (in UnifiedLedgerView) was showing dates with hardcoded locale (e.g. `toLocaleDateString('en-GB')`), so the format did not follow business settings and could show a year-month-day style when the business preferred DD/MM/YYYY or MM/DD/YYYY.

---

## Requirement

- Every date in Account Statement (and the rest of UnifiedLedgerView) should use the **global business date format and timezone**.
- No hardcoded YYYY-MM-DD or en-GB unless the business has chosen that format.

---

## Changes

In **UnifiedLedgerView**:

- The view already uses `useFormatDate()`; `formatDateTime` was added to the destructuring.
- **Shipment ledger table:** `row.date` is now shown as `formatDate(new Date(row.date))` instead of `new Date(row.date).toLocaleDateString()`.
- **Summary view (per entry):** The line that showed `entry.date.toLocaleDateString('en-GB')` and `entry.date.toLocaleTimeString(...)` was replaced with `formatDateTime(entry.date)`.
- **Detailed report table:** Date column changed from `entry.date.toLocaleDateString('en-GB')` to `formatDate(entry.date)`.
- **Statement view (Account Statement):** Date column changed from `entry.date.toLocaleDateString('en-GB')` to `formatDate(entry.date)`.

All of these now go through the canonical formatter that uses `company.dateFormat` and `company.timezone` (and `formatDateTime` uses `company.timeFormat` for time).

---

## Files changed

- `src/app/components/shared/UnifiedLedgerView.tsx` – use `formatDate` and `formatDateTime` from `useFormatDate()` for all date and date+time displays (shipment table, summary, detailed table, statement table).

---

## Rollback

Revert the UnifiedLedgerView changes; dates will revert to the previous locale-based formatting.
