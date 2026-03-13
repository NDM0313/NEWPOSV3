# ERP Global Timezone System

**Project:** NEW POSV3 ERP  
**Date:** 2026-03-13  
**Phase:** 2 — Global Timezone System (Master Roadmap)

---

## 1. Goal

Support **multi-country ERP usage**: Pakistan (Asia/Karachi), India (Asia/Kolkata), China (Asia/Shanghai), etc., with database in UTC and display in company timezone.

---

## 2. Design

| Layer        | Rule |
|-------------|------|
| **Database** | All timestamps stored in **UTC** (TIMESTAMPTZ). |
| **Company**  | `companies.timezone` (IANA, e.g. `Asia/Karachi`, `UTC`). |
| **Web ERP**  | Convert for display using company timezone (e.g. `useFormatDate`, `company.timezone`). |
| **Mobile ERP** | Convert for display using company timezone when showing dates/times. |

---

## 3. Implementation

### 3.1 Database

- **Migration:** `migrations/companies_timezone_column.sql`
  - Adds `companies.timezone TEXT DEFAULT 'UTC'` if not present.
- **Create business:** `create_business_transaction` already accepts `p_timezone` and writes to `companies.timezone`.

### 3.2 Web frontend

- **Settings:** Company timezone is loaded from `companies` (e.g. `SettingsContext`, `company.timezone`).
- **Formatting:** `useFormatDate()` uses `company?.timezone || 'Asia/Karachi'`; `formatDate` / `formatDateTime` in `src/app/utils/formatDate.ts` take a `timezone` argument.
- **Create Business:** `CreateBusinessWizard` sends `timezone` (default `Asia/Karachi`).
- **Settings page:** Timezone can be edited and saved to company (via `updateCompanySettings` / companies update).

### 3.3 Mobile ERP

- **Current:** Date display (e.g. `DateRangeSelector`, report dates) uses device locale/timezone.
- **Required:** When displaying dates/times to the user, use **company timezone** (e.g. from company or settings API).
- **Recommendation:** Fetch company (or include `timezone` in existing company/settings response) and use it in date formatting (e.g. a small `useCompanyTimezone()` or pass timezone into report/date components).

---

## 4. Outputs

- This document: `docs/ERP_GLOBAL_TIMEZONE_SYSTEM.md`
- Migration: `migrations/companies_timezone_column.sql`

---

## 5. Verification

- Ensure `companies.timezone` exists and is used by web (already in place).
- Ensure new businesses can set timezone at creation.
- Ensure mobile uses company timezone for date/time display when company is loaded.
