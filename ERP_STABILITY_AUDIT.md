# ERP System – Global Settings & Stability Audit Report

**Date:** February 2026  
**Role:** Senior Software Architect  
**Goal:** Ensure ERP is globally stable before final launch – business settings properly structured and consistently applied.

---

## Executive Summary

The ERP system has a **solid foundation** (SettingsContext, settingsService, companies table) but **critical gaps** exist in:

1. **New Business Creation** – Only 4 fields captured; 6+ essential settings missing
2. **Global Propagation** – Currency, timezone, date format hardcoded in 100+ places
3. **Settings Structure** – Functional but not logically grouped (Business vs Financial vs System)
4. **Data Safety** – Currency change would distort past invoices (no per-transaction currency)
5. **Hardcoded Values** – Rs, $, PKR, Asia/Karachi, en-PK, toFixed(2) scattered across codebase

**Recommendation:** Implement a **phased fix** before launch. Phase 1 (Critical) can be done in 2–3 days; full stabilization in 1–2 weeks.

---

## PART 1: CREATE NEW BUSINESS – INITIAL CONFIGURATION

### Current Status

| Required Setting | Status | Where Stored |
|-----------------|--------|--------------|
| 1. Business Name | ✅ | `companies.name` |
| 2. Default Currency | ❌ | Not asked; `companies.currency` exists but not set on create |
| 3. Currency Symbol Position | ❌ | Not implemented |
| 4. Date Format | ❌ | Not implemented |
| 5. Time Format | ❌ | Not implemented |
| 6. Financial Year Start Date | ❌ | `companies.financial_year_start` exists but not set |
| 7. Default Timezone | ❌ | Not implemented |
| 8. Measurement Unit | ⚠️ | Piece unit auto-created; no user choice |
| 9. Tax System (Enabled/Disabled) | ❌ | Not implemented |
| 10. Decimal Precision | ❌ | Not implemented |

### Current Flow

- **CreateBusinessForm.tsx** – Collects: Business Name, Owner Name, Email, Password
- **create_business_transaction.sql** – Creates: company (name, email only), branch, user, Piece unit, default accounts
- **companies table** – Has `currency`, `financial_year_start` columns but they are **never populated** during creation

### Weak Points

1. New business gets `currency = NULL` → fallbacks to hardcoded `PKR` / `Rs` everywhere
2. No fiscal year set → accounting reports may use wrong date range
3. Timezone hardcoded in `appConfig.ts` (Asia/Karachi) – not business-configurable
4. Date/time format hardcoded (en-GB, en-US) – not user-configurable

### Required Fixes

1. **Extend CreateBusinessForm** – Add wizard step or expand form with:
   - Default Currency (dropdown: PKR, USD, EUR, etc.)
   - Financial Year Start (date picker, default: 1 July)
   - Timezone (dropdown: Asia/Karachi, UTC, America/New_York, etc.)
   - Decimal Precision (2 or 3)
   - Tax Enabled (toggle)

2. **Update create_business_transaction** – Accept new params and insert into `companies`:
   ```sql
   INSERT INTO companies (..., currency, financial_year_start, ...)
   VALUES (..., p_currency, p_fiscal_year_start, ...);
   ```

3. **Create settings table / key-value** – Store: `currency_symbol_position`, `date_format`, `time_format`, `decimal_precision`, `tax_enabled`, `default_timezone` at company level

---

## PART 2: GLOBAL SETTINGS PROPAGATION

### Currency

| Module | Uses Company Currency? | Issue |
|--------|------------------------|-------|
| Dashboard | ❌ | `formatCurrency(value)` – defaults to `Rs` |
| SaleForm | ✅ | `company?.currency \|\| 'Rs'` |
| PurchaseForm | ✅ | Passes currency |
| AccountingDashboard | ❌ | Uses `$` hardcoded in 6+ places |
| TopHeader notifications | ❌ | `Rs ${sale.due.toLocaleString()}` |
| CustomerLedgerPage | ❌ | `Rs {openingBalance}` hardcoded |
| LedgerPrintView | ❌ | `Rs {totalDebit}` hardcoded |
| PaymentModal | ❌ | `formatCurrency(amount)` – no currency param |
| Print layouts (Invoice, SaleReturn, PurchaseReturn) | ❌ | `Rs.` hardcoded |
| StudioCostsTab | ❌ | Local `formatCurrency` with default `Rs` |

**Propagation:** Currency is loaded in SettingsContext from `companies.currency` but **not passed** to most components. `formatCurrency(value, currency)` exists but is rarely called with the second param.

### Financial Year

- Stored in: `settings` table → `accounting_settings` → `fiscalYearStart`, `fiscalYearEnd`
- Also: `companies.financial_year_start` (column exists, rarely used)
- **Issue:** Reports (Profit & Loss, Balance Sheet) must filter by fiscal year. Need to verify all report queries use `accountingSettings.fiscalYearStart/End`.

### Date Format

- **Current:** `formatLongDate`, `formatDateAndTime` use `en-GB` (DD MMM YYYY) and `en-US` for time
- **Issue:** No configurable format (DD/MM/YYYY vs MM/DD/YYYY vs YYYY-MM-DD)
- **Propagation:** All date display goes through `utils.ts` – single point, but format is hardcoded

### Timezone

- **Current:** `APP_TIMEZONE = 'Asia/Karachi'` in `src/lib/appConfig.ts`
- **Issue:** Hardcoded; not business-configurable
- **Propagation:** Used in `formatDateWithTimezone`, `getTodayInAppTimezone`, `formatDateToYYYYMMDD` – consistent but inflexible

### Unit Selection

- **Current:** Units from `units` table; product has `unit_id`; inventory/sales use product’s unit
- **Status:** ✅ Properly applied – unit comes from product, product from DB
- **Note:** Default unit (Piece) created on business creation – no user choice for “primary” unit

---

## PART 3: SETTINGS MODULE STRUCTURE

### Current Tabs (SettingsPageNew)

| Tab | Content | Fits Category? |
|-----|---------|----------------|
| Company Info | Business name, address, tax, currency, logo | Business Settings |
| Branch Management | Branches CRUD | Business Settings |
| POS Settings | Cash account, receipt, discount | Module-specific |
| Sales Settings | Payment, ledger, invoice prefix | Module-specific |
| Purchase Settings | GRN, approval, payment terms | Module-specific |
| Inventory Settings | Low stock, packing, valuation | Module-specific |
| Rental Settings | Late fee, deposit, advance | Module-specific |
| Accounting Settings | Fiscal year, tax method, currency | Financial Settings |
| Default Accounts | Cash, Bank, Wallet mapping | Financial Settings |
| Numbering Rules | Prefixes for SL-, PUR-, etc. | System Preferences |
| User Management | Users CRUD | Business Settings |
| Module Toggles | Enable/disable modules | System Preferences |

### Gaps

1. **No dedicated "System Preferences"** – Date format, time format, timezone, decimal precision, theme
2. **No "Printer Settings"** – Receipt template, invoice layout, paper size
3. **No "Theme Settings"** – Dark/light mode (handled by app, not settings DB)
4. **Overlap:** Currency in both Company Info and Accounting Settings

### Recommendation

- Add **System Preferences** tab: Timezone, Date Format, Time Format (12h/24h), Decimal Precision, Currency Symbol Position
- Add **Printer Settings** tab (or subsection): Receipt, Invoice, Thermal
- Keep module-specific tabs; ensure no duplicate keys

---

## PART 4: DATA SAFETY CHECK

### Financial Year Change

- **Risk:** Changing fiscal year could misalign reports (e.g. P&L for wrong period)
- **Current:** `accountingSettings.fiscalYearStart/End` stored in settings; reports should filter by these
- **Mitigation:** Ensure all accounting/report queries use fiscal year from settings. Old data (sales, purchases) is date-stamped; filtering by new fiscal range is safe. **No data corruption** – only display/calculation range changes.

### Currency Change

- **Risk:** Past invoices stored as numeric amounts only. No `currency` column on `sales` or `purchases`.
- **Impact:** If business switches from PKR to USD, **all historical amounts would display with new currency** – semantically wrong (Rs 10,000 ≠ $10,000).
- **Mitigation:** 
  - **Option A:** Add `currency` column to `sales`, `purchases`, `expenses`; backfill existing rows with company default; new transactions store currency at creation
  - **Option B:** Never allow currency change after first sale (or warn heavily)
  - **Option C:** Store currency per transaction; display with original currency + optional conversion

### Decimal Precision Change

- **Risk:** Changing from 2 to 3 decimals could cause rounding drift in reports
- **Current:** `toFixed(2)` used in 50+ places; `formatDecimal(value, 2)` in utils
- **Impact:** Amounts stored in DB as numeric – no precision loss. Display only. Changing precision affects **new** formatting; old printed invoices retain original format.
- **Mitigation:** Use `settings.decimalPrecision` in `formatCurrency` and `formatDecimal`; avoid `toFixed(2)` hardcoding.

---

## PART 5: FINAL STABILITY CHECK

### Hardcoded Values – Summary

| Type | Count (approx) | Files | Fix |
|------|----------------|-------|-----|
| `Rs` / `Rs.` | 50+ | TopHeader, CustomerLedgerPage, LedgerPrintView, print layouts, etc. | Use `company.currency` or `formatCurrency(value, currency)` |
| `$` | 25+ | AccountingDashboard, reports | Same |
| `PKR` | 10+ | SettingsContext defaults, StudioSaleDetailNew | Use company currency |
| `en-PK` | 20+ | Ledger, TransactionClassicView | Use locale from settings |
| `Asia/Karachi` | 1 | appConfig.ts | Move to company/settings |
| `toFixed(2)` | 50+ | FullStockLedgerView, CustomerLedgerPage, etc. | Use `formatDecimal(value, precision)` |
| `en-GB` / `en-US` | 5+ | utils.ts | Use format from settings |

### Missing Global Config

1. **Currency symbol position** – Before (Rs 100) vs After (100 Rs)
2. **Date format** – DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD
3. **Time format** – 12h vs 24h
4. **Decimal precision** – 2 vs 3 (or more)
5. **Default timezone** – Per business
6. **Tax enabled** – Global toggle
7. **Locale** – For number/date formatting (en-PK, en-US, etc.)

### Modules Using Independent Logic

- **AccountingDashboard** – Uses `$` and own formatting
- **StudioCostsTab** – Local `formatCurrency` with `Rs` default
- **PaymentModal, PaymentFooterWidget** – `formatCurrency` without currency param
- **Customer Ledger (modern + classic)** – Hardcoded `Rs`, `en-PK`
- **Print layouts** – All use `Rs.` or `Rs`

---

## REQUIRED FIXES – Prioritized

### Phase 1: Critical (Pre-Launch)

1. **Create Business – Set defaults**
   - In `create_business_transaction`: Set `companies.currency = 'PKR'`, `financial_year_start` = first day of current fiscal year
   - Or extend CreateBusinessForm to collect currency + fiscal year start

2. **Centralize currency in formatCurrency**
   - Create `useFormatCurrency()` hook that reads `company.currency` from SettingsContext
   - Replace all `formatCurrency(value)` with `formatCurrency(value, company.currency)`
   - Fix AccountingDashboard `$` → use company currency

3. **Fix hardcoded Rs in high-traffic areas**
   - TopHeader notifications
   - Dashboard (already uses formatCurrency but without param – add useSettings)
   - SaleForm, PurchaseForm (already pass currency – verify)
   - PaymentModal, PaymentFooterWidget

### Phase 2: Important (Within 2 Weeks)

4. **Add System Preferences to Settings**
   - Decimal precision (2, 3)
   - Timezone (dropdown)
   - Date format (dropdown)
   - Time format (12h/24h)

5. **Propagate decimal precision**
   - Add `decimalPrecision` to company/settings
   - Update `formatCurrency` and `formatDecimal` to use it
   - Replace `toFixed(2)` with `formatDecimal(value, precision)` where applicable

6. **Currency per transaction (optional)**
   - Add `currency` to sales, purchases if multi-currency planned
   - Or document: "Currency change not supported after first transaction"

### Phase 3: Nice to Have

7. **Settings restructure**
   - Group: Business Settings | Financial Settings | System Preferences | Printer Settings
   - Add Printer Settings section

8. **Create Business wizard**
   - Step 1: Business Name, Owner, Email, Password
   - Step 2: Currency, Fiscal Year Start, Timezone, Decimal Precision, Tax Enabled

---

## FINAL RECOMMENDATION

**Before launch:**

1. ✅ Implement Phase 1 (currency propagation + create business defaults)
2. ✅ Add `currency` to CreateBusinessForm and `create_business_transaction`
3. ✅ Fix all `Rs`/`$` hardcoding in Dashboard, Accounting, Payments, Notifications, Print layouts
4. ⚠️ Document: "Changing currency after first sale may misrepresent historical amounts"
5. ⚠️ Add migration to backfill `companies.currency = 'PKR'` for existing companies where NULL

**Post-launch (stability):**

6. Add System Preferences (timezone, date format, decimal precision)
7. Consider currency-per-transaction for future multi-currency support
8. Restructure Settings tabs for clarity

---

## Appendix: File Reference

| Area | Key Files |
|------|-----------|
| Create Business | `CreateBusinessForm.tsx`, `businessService.ts`, `create_business_transaction.sql` |
| Settings | `SettingsContext.tsx`, `settingsService.ts`, `SettingsPageNew.tsx` |
| Currency | `formatCurrency.ts`, `Dashboard.tsx`, `AccountingDashboard.tsx`, `SaleForm.tsx`, `PurchaseForm.tsx` |
| Date/Time | `utils.ts`, `appConfig.ts` |
| Companies | `companies` table (currency, financial_year_start) |
| Settings storage | `settings` table (key-value), `companies` table |

---

*End of Audit Report*
