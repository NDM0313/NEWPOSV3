# 🔥 FINAL QA + PRODUCTION RELEASE – Status & Summary

**Date:** February 2025  
**Project:** Modern ERP POS (NEW POSV3)

---

## ✅ STEP 1 – Backend Final Verification

### 1️⃣ Migration Check

| Migration | File | Status |
|-----------|------|--------|
| 43_companies_finalization.sql | `supabase-extract/migrations/43_companies_finalization.sql` | ✅ Present |
| 44_rental_status_enum_alignment.sql | `supabase-extract/migrations/44_rental_status_enum_alignment.sql` | ✅ Present |
| 41_customer_ledger_rpc_company_only.sql | `supabase-extract/migrations/41_customer_ledger_rpc_company_only.sql` | ✅ Present |
| 45_get_customer_ledger_rentals_rpc.sql | `supabase-extract/migrations/45_get_customer_ledger_rentals_rpc.sql` | ✅ Present |

**⚠ Migration 45 – Return type mismatch**

- Error seen earlier: `cannot change return type of existing function` (Row type defined by OUT parameters is different).
- **Fix applied:** `45_get_customer_ledger_rentals_rpc.sql` now includes `DROP FUNCTION IF EXISTS get_customer_ledger_rentals(UUID, UUID, DATE, DATE);` before `CREATE OR REPLACE FUNCTION`, so re-running migrations will apply cleanly.

**Check:** Run `npm run dev` (with DB URL in `.env.local`). If it starts without migration failure → backend aligned.  
If no DB URL: use `npm run dev:no-migrate` for frontend-only; migrations will run when DB is configured.

---

### 2️⃣ RPC Verification (Manual)

Test manually in the app:

- [ ] Sales ledger
- [ ] Rental ledger
- [ ] Payment reverse
- [ ] Commission journal entry
- [ ] No error in console

---

## ✅ STEP 2 – Functional QA Checklist (Manual)

Run through:

| Area | Items |
|------|--------|
| **SALES** | Add Sale, Edit Sale, Delete Sale, Add Payment, Reverse Payment, Commission, Packing modal |
| **PURCHASE** | Add Purchase, Return Purchase, Payment flow |
| **RENTALS** | New booking, Pickup, Return, Damage penalty, Status transitions |
| **STUDIO** | Stage change, Worker assign, Cost update, Ledger update |
| **REPORTS** | Date range filter, Financial year filter, Export |
| **SETTINGS** | Currency, Timezone, Decimal precision, Save, About (version + build date) |

---

## ✅ STEP 3 – Currency & Date Stress Test (Manual)

Change in Settings:

- Currency → USD  
- Decimal precision → 3  
- Date format → MM/DD/YYYY  
- Timezone  

Check: Dashboard, Sales, Products, Reports, Rentals update dynamically.

---

## ✅ STEP 4 – Production Build Test

**Result:** ✅ **PASSED**

- Command: `npm run build`
- Exit code: 0
- Output: `✓ built in 38.35s`
- `dist/` folder generated
- Warnings (non-blocking): dynamic/static import mix, some chunks > 500 kB; build not broken

---

## ✅ STEP 5 – PWA Test (Manual)

- Deploy to HTTPS
- Open in mobile browser
- Check: Installable, offline (basic caching), app icon, splash, About version

---

## ✅ STEP 6 – Version Discipline

- **Current version in package.json:** `"version": "0.0.1"`
- Before release: bump as needed (e.g. `1.0.0`), then `npm run build` (build timestamp auto-set).

---

## ✅ STEP 7 – Android Packaging (Optional)

If ready:

```bash
npm install @capacitor/core @capacitor/cli
npx cap init "Modern ERP POS" "com.yourapp.erp" --web-dir dist
npm run build
npx cap add android
npx cap copy
npx cap open android
```

Android Studio → Generate APK/AAB.

---

## 🧠 Release Decision Tree

| Condition | Action |
|-----------|--------|
| All QA passed | Release |
| Minor UI bug | Patch & rebuild |
| RPC error | Fix before release |
| Currency mismatch | Fix before release |
| Dev works but build fails | Fix before release |

---

## ⚠ Remaining Hardcoded Currency / toLocaleString (For Later Cleanup)

These files still use `Rs`, `$`, or `toLocaleString()` for **money** display. They do not block build; align with `useFormatCurrency()` when touching those modules:

| File | Notes |
|------|--------|
| SettingsPageNew.tsx | `Rs {acc.balance.toLocaleString()}` in account lists |
| StudioDashboardNew.tsx | Multiple `Rs {…toLocaleString()}` |
| ReturnModal.tsx (rentals) | `$…toLocaleString()` for penalty/totals |
| RentalsPage.tsx | `$summary.totalAmount/toLocaleString()`, `$summary.totalDue/toLocaleString()` |
| SaleForm.tsx | Uses `toLocaleString('en-US', …)` and currency variable in places; can be switched to formatCurrency |
| PurchasesPage.tsx | `purchase.grandTotal.toLocaleString()` |

**Already aligned:** SalesPage.tsx (formatCurrency), ProductsPage, EnhancedProductForm, ExpensesDashboard, Dashboard, StockDashboard.

**Date display:** ViewSaleDetailsDrawer, ViewPaymentsModal use `toLocaleString()` for date/time; can later use `useFormatDate()` for consistency.

---

## ✔ Final Release Checklist

Before release, ensure:

- [ ] No reliance on `dev:no-migrate` for normal dev (migrations apply with `npm run dev` when DB is set).
- [ ] No console errors in critical flows.
- [ ] No hardcoded currency in **new** code; existing spots documented above for gradual cleanup.
- [ ] No hardcoded date format in new code where useFormatDate exists.
- [ ] Migration 45 applied (or DROP + re-run as above).

---

*Generated after production build test and migration/file verification.*
