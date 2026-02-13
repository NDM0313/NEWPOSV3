# Phase 3: Production Hardening & Operational Readiness – Status Report

**Date:** February 2026  
**Goal:** ERP ko production-level SaaS banane ke liye secure, optimized aur stable banana.

---

## ✅ COMPLETED TASKS (Jo ho chuka hai)

### Part 1 – Role & Permission Hardening ✅

| Item | Status | Location |
|------|--------|----------|
| `checkPermission(userRole, action)` utility | ✅ Done | `src/app/utils/checkPermission.ts` |
| `useCheckPermission` hook | ✅ Done | `src/app/hooks/useCheckPermission.ts` |
| Sales edit/delete permission | ✅ Done | `SalesPage.tsx` – `canEditSale`, `canDeleteSale`, `canCreateSale` |
| Purchase delete restricted | ✅ Done | `PurchasesPage.tsx` – `canDeletePurchase` (default false for non-Admin) |
| Reports view restricted | ✅ Done | `ReportsDashboardEnhanced.tsx` – `canViewReports` gate |
| Accounting view restricted | ✅ Done | `AccountingDashboard.tsx` – `canAccessAccounting` gate |
| Sidebar hides unauthorized items | ✅ Done | `Sidebar.tsx` – Reports, Settings, Users hidden by permission |
| Backend RLS | ✅ Exists | `create-rls-functions.sql` – `has_module_permission()` |

**Modules:** sales, purchases, reports, settings, users, accounting, payments, expenses, products, rentals

---

### Part 2 – Printer Config Centralization ✅

| Item | Status | Location |
|------|--------|----------|
| Printer config in DB | ✅ Done | `companies.printer_mode`, `default_printer_name`, `print_receipt_auto` |
| Migration | ✅ Done | `supabase-extract/migrations/42_companies_printer_config.sql` |
| `usePrinterConfig` hook | ✅ Done | `src/app/hooks/usePrinterConfig.ts` |
| ClassicPrintBase accepts printerMode | ✅ Done | `src/app/components/shared/ClassicPrintBase.tsx` |
| InvoicePrintLayout | ✅ Done | Uses `usePrinterConfig`, passes `printerMode` |
| SaleReturnPrintLayout | ✅ Done | Uses `usePrinterConfig`, passes `printerMode` |
| PurchaseReturnPrintLayout | ✅ Done | Uses `usePrinterConfig`, passes `printerMode` |
| PurchaseOrderPrintLayout | ✅ Done | Uses `usePrinterConfig`, passes `printerMode` |
| RentalPrintLayout | ✅ Done | Uses `usePrinterConfig`, passes `printerMode` |
| StockLedgerClassicPrintView | ✅ Done | Uses `usePrinterConfig`, passes `printerMode` |

**Thermal / A4 mode:** Config-driven, no hardcoded print styling in layouts.

---

### Part 3 – Error Handling & Logging ✅ (Partial)

| Item | Status | Location |
|------|--------|----------|
| Global Error Boundary | ✅ Done | `src/app/components/shared/ErrorBoundary.tsx` |
| Error Boundary wraps App | ✅ Done | `App.tsx` |
| Standardized error toast | ✅ Done | `src/app/utils/errorToast.ts` |
| Logger utility | ✅ Done | `src/app/utils/logger.ts` |
| Supabase error interceptor | ✅ Done | `src/app/utils/supabaseErrorInterceptor.ts`, `src/lib/supabaseWithInterceptor.ts` |

**Note:** Supabase interceptor file exists but main app may still use `src/lib/supabase.ts`. Integration check needed.

---

### Part 4 – Data Backup & Export ✅ (Partial)

| Item | Status | Location |
|------|--------|----------|
| CSV export | ✅ Done | `src/app/utils/exportUtils.ts` – `exportToCSV()` |
| Excel export | ✅ Done | `exportToExcel()` |
| PDF export | ✅ Done | `exportToPDF()` |
| JSON export | ✅ Done | `exportToJSON()` |
| backupService | ✅ Done | `src/app/services/backupService.ts` |
| backupExport utility | ✅ Done | `src/app/utils/backupExport.ts` |

**Note:** Company-level backup UI (Settings page button) may need to be wired.

---

### Part 5 – Performance Optimization ✅ (Partial)

| Item | Status | Location |
|------|--------|----------|
| Lazy load ReportsDashboardEnhanced | ✅ Done | `App.tsx` – `lazy(() => import(...))` |
| Lazy load SettingsPageNew | ✅ Done | `App.tsx` |
| Lazy load InventoryDashboardNew | ✅ Done | `App.tsx` |
| Lazy load StudioDashboardNew | ✅ Done | `App.tsx` |
| Lazy load StudioPipelinePage | ✅ Done | `App.tsx` |
| Lazy load AccountingDashboard | ✅ Done | `App.tsx` |

---

### Phase 2 (Earlier) – Currency & Date Hardening ✅

| Item | Status |
|------|--------|
| formatCurrency utility | ✅ `src/app/utils/formatCurrency.ts` |
| useFormatCurrency hook | ✅ `src/app/hooks/useFormatCurrency.ts` |
| formatDate / formatDateTime | ✅ `src/app/utils/formatDate.ts`, `useFormatDate.ts` |
| ViewPurchaseDetailsDrawer | ✅ All Rs. replaced with formatCurrency |
| ReportsDashboardEnhanced | ✅ formatCurrency, formatDate |
| UnifiedLedgerView | ✅ formatCurrency |
| customer-ledger-test tabs | ✅ formatCurrency, formatDate |
| CreateBusinessForm | ✅ Currency, Financial Year Start |

---

## 🔲 REMAINING TASKS (Jo complete karna hai – Windows par)

### Part 3 – Error Handling (Remaining)

1. **Supabase Interceptor Integration**
   - File: `src/lib/supabase.ts`
   - Action: Replace `createClient` with `createClientWithInterceptor` from `supabaseWithInterceptor.ts` (ya phir `supabase.ts` mein hi interceptor add karo)
   - Purpose: API errors par automatic toast + optional logging

2. **Error Boundary – Production Logging**
   - File: `src/app/components/shared/ErrorBoundary.tsx`
   - Action: `onError` callback mein `logger.error()` call add karo taake production mein errors log hon

3. **Silent Failure Check**
   - Search: `catch (e) { }` ya `catch { }` – empty catch blocks
   - Action: Har jagah `toast.error()` ya `logger.error()` add karo

---

### Part 4 – Data Backup (Remaining)

1. **Company Backup UI**
   - File: `src/app/components/settings/SettingsPageNew.tsx` (ya dedicated Backup tab)
   - Action: "Export Company Data" button add karo
   - On click: `backupService.exportCompanyData(companyId)` call karo → JSON download

2. **backupService.exportCompanyData()**
   - File: `src/app/services/backupService.ts`
   - Action: Agar function incomplete hai to complete karo – sales, purchases, contacts, products, expenses fetch karke JSON export

---

### Part 5 – Performance (Remaining)

1. **More Lazy Loading**
   - Files: `App.tsx`
   - Action: In pages ko lazy load karo:
     - `StudioSalesListNew`, `StudioSaleDetailNew`
     - `InventoryDesignTestPage`, `InventoryAnalyticsTestPage`
     - `CustomerLedgerTestPage`, `CustomerLedgerInteractiveTest`
     - `UserDashboard`, `RolesDashboard`

2. **Memoization**
   - Heavy list components (e.g. SalesPage table, PurchasesPage table) par `React.memo` apply karo
   - `useMemo` for expensive computations (already kuch jagah hai)

3. **Duplicate API Calls**
   - Audit: Same data multiple components mein fetch to nahi ho raha
   - Solution: Context ya shared cache use karo

---

### Part 6 – Build Safety Check

1. **Production Build**
   ```bash
   npm run build
   ```
   - Agar errors aaye to fix karo

2. **Console Cleanup**
   - Search: `console.log`, `console.debug`, `console.warn`
   - Production build mein strip ho jate hain (Vite default) – verify karo

3. **Environment Variables**
   - `.env.example` file banao with:
     ```
     VITE_SUPABASE_URL=
     VITE_SUPABASE_ANON_KEY=
     ```
   - `.env` git mein add mat karo (already .gitignore mein hona chahiye)

4. **Dev-only Configs**
   - Search: `import.meta.env.DEV` – ensure production code path clean hai

---

## 📁 KEY FILES REFERENCE

| Purpose | Path |
|---------|------|
| Permission check | `src/app/utils/checkPermission.ts` |
| Permission hook | `src/app/hooks/useCheckPermission.ts` |
| Printer config | `src/app/hooks/usePrinterConfig.ts` |
| Error boundary | `src/app/components/shared/ErrorBoundary.tsx` |
| Error toast | `src/app/utils/errorToast.ts` |
| Logger | `src/app/utils/logger.ts` |
| Export utils | `src/app/utils/exportUtils.ts` |
| Backup service | `src/app/services/backupService.ts` |
| Supabase client | `src/lib/supabase.ts` |
| Supabase + interceptor | `src/lib/supabaseWithInterceptor.ts` |

---

## 🪟 WINDOWS PAR COMPLETE KARNE KE STEPS

1. **Repo clone/pull**
   ```bash
   git clone <repo-url>
   cd NEWPOSV3
   git pull
   ```

2. **Dependencies**
   ```bash
   npm install
   # ya
   pnpm install
   ```

3. **Env file**
   - `.env` banao (`.env.example` se copy)
   - `VITE_SUPABASE_URL` aur `VITE_SUPABASE_ANON_KEY` set karo

4. **Remaining tasks**
   - PHASE3_STATUS.md open karo
   - "REMAINING TASKS" section follow karo
   - Har task ke baad `npm run build` chala kar verify karo

5. **Build test**
   ```bash
   npm run build
   npm run dev   # local test
   ```

---

## 📋 SUMMARY

| Part | Completed | Remaining |
|------|-----------|-----------|
| 1. Role & Permission | ✅ 100% | — |
| 2. Printer Config | ✅ 100% | — |
| 3. Error Handling | ~80% | Interceptor integration, logging |
| 4. Data Backup | ~70% | Backup UI, service completion |
| 5. Performance | ~60% | More lazy load, memoization |
| 6. Build Safety | 0% | Build run, console check, env |

**Overall Phase 3:** ~75% complete. Remaining work Windows par 1–2 din mein ho sakta hai.
