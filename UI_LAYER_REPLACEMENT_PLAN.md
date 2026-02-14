# UI Layer Replacement Plan – Figma Mobile UI into ERP

**Rules:** No changes to main.tsx, Supabase/SupabaseContext, vite.config.ts, package.json (except add UI deps), PWA files, SW registration, versioning, routing root, React root. **UI component layer only.**

---

## PART 1 – STRUCTURE ANALYSIS

### 1. Layout component

| Item | Path | Role |
|------|------|------|
| Layout | `src/app/components/layout/Layout.tsx` | Wraps Sidebar + TopHeader + main + BottomNav |
| Sidebar | `src/app/components/layout/Sidebar.tsx` | Desktop nav; uses `useSettings`, module toggles |
| TopHeader | `src/app/components/layout/TopHeader.tsx` | Header; uses `useSupabase`, `useFormatCurrency`, sales/purchases/expenses |
| BottomNav | `src/app/components/layout/BottomNav.tsx` | Mobile bottom navigation |
| BranchSelector | `src/app/components/layout/BranchSelector.tsx` | Branch switch; uses `useSupabase` |
| GlobalDrawer | `src/app/components/layout/GlobalDrawer.tsx` | Global add/edit drawers; uses `useSupabase` |

### 2. Dashboard component

| Item | Path |
|------|------|
| Dashboard | `src/app/components/dashboard/Dashboard.tsx` |
| StockDashboard | `src/app/components/dashboard/StockDashboard.tsx` |
| ExpensesDashboard | `src/app/components/dashboard/ExpensesDashboard.tsx` |

### 3. Module → component mapping

| Module | Primary component(s) | Context / services |
|--------|------------------------|---------------------|
| **Sales** | `SalesPage.tsx`, `SaleForm.tsx`, `ViewSaleDetailsDrawer.tsx`, `ViewPaymentsModal.tsx` | SalesContext, saleService, useCheckPermission |
| **Purchase** | `PurchasesPage.tsx`, `PurchaseForm.tsx`, `ViewPurchaseDetailsDrawer.tsx` | PurchaseContext, purchaseService, useCheckPermission |
| **Rental** | `RentalDashboard.tsx`, `NewRentalBooking.tsx`, `RentalBookingDrawer.tsx`, `RentalOrdersList.tsx`, `ViewRentalDetailsDrawer.tsx` | RentalContext, rentalService |
| **Studio** | `StudioSalesListNew.tsx`, `StudioSaleDetailNew.tsx`, `StudioDashboardNew.tsx`, `StudioPipelinePage.tsx` | ProductionContext, studioService, studioProductionService |
| **Reports** | `ReportsDashboardEnhanced.tsx` | useCheckPermission (canViewReports) |
| **Settings** | `SettingsPageNew.tsx` (lazy in App) | SettingsContext, useSupabase, branchService, settingsService |
| **Products** | `ProductsPage.tsx`, `EnhancedProductForm.tsx` | productService, useCheckPermission |
| **Accounting** | `AccountingDashboard.tsx` (lazy) | AccountingContext, useCheckPermission (canAccessAccounting) |
| **Contacts** | `ContactsPage.tsx`, `ContactList.tsx` | contactService |
| **Inventory** | `InventoryDashboardNew.tsx`, `InventoryDesignTestPage.tsx` | inventoryService |

### 4. Routing entry point

- **Entry:** `App.tsx` (root component; **do not modify**).
- **Mechanism:** `NavigationProvider` (NavigationContext) holds `currentView`; `AppContent` reads `currentView` and renders one of the components above inside `<Layout>`. POS view bypasses Layout (renders `<POS />` + `<GlobalDrawer />`).
- **No React Router:** View state is context-based; Sidebar/BottomNav call `setCurrentView(view)`.

**Conclusion:** Routing is fully inside App.tsx + NavigationContext. Replacement must keep the same view keys and component names (or same default exports) so App.tsx imports continue to work without change.

---

## PART 2 – SAFE DIRECT REPLACEMENT STRATEGY

**Order:** Replace UI (JSX + styles) module-by-module; keep all context usage, service calls, permissions, and formatCurrency/formatDate.

| Step | Module | Target files (replace UI only) | Keep intact |
|------|--------|--------------------------------|-------------|
| 1 | **Layout** | `Layout.tsx`, `Sidebar.tsx`, `TopHeader.tsx`, `BottomNav.tsx`, `BranchSelector.tsx`, `GlobalDrawer.tsx` | useSettings, useSupabase, useFormatCurrency, setCurrentView, permission gates |
| 2 | **Dashboard** | `Dashboard.tsx`, `StockDashboard.tsx`, `ExpensesDashboard.tsx` | Any context/service used |
| 3 | **Products** | `ProductsPage.tsx`, `EnhancedProductForm.tsx`, list/card components | productService, useCheckPermission |
| 4 | **Sales** | `SalesPage.tsx`, `SaleForm.tsx`, `ViewSaleDetailsDrawer.tsx`, `ViewPaymentsModal.tsx`, sale list/detail UI | SalesContext, saleService, canEditSale/canDeleteSale |
| 5 | **Purchases** | `PurchasesPage.tsx`, `PurchaseForm.tsx`, `ViewPurchaseDetailsDrawer.tsx` | PurchaseContext, purchaseService, canDeletePurchase |
| 6 | **Rentals** | `RentalDashboard.tsx`, `NewRentalBooking.tsx`, `RentalBookingDrawer.tsx`, `RentalOrdersList.tsx`, `ViewRentalDetailsDrawer.tsx` | RentalContext, rentalService |
| 7 | **Studio** | `StudioSalesListNew.tsx`, `StudioSaleDetailNew.tsx`, `StudioDashboardNew.tsx`, `StudioPipelinePage.tsx` | ProductionContext, studio* services |
| 8 | **Reports** | `ReportsDashboardEnhanced.tsx` | canViewReports, report data fetching |
| 9 | **Settings** | `SettingsPageNew.tsx` | SettingsContext, branchService, settingsService, companyId |

**Rules per module:**

- Replace only: JSX structure, className, local state for UI (e.g. open/close), Figma-based layout/components.
- Do **not** remove or rename: context hooks, service calls, permission checks, formatCurrency/formatDate, or export names that App.tsx imports.
- If Figma has different file names, merge Figma’s UI into the **existing** file paths so App.tsx and existing imports do not change.
- **Styles:** Merge Figma styles into `src/styles` or existing Tailwind usage; do not add a second React root or duplicate global entry.

---

## PART 3 – DEPENDENCY ALIGNMENT

- **Keep:** All existing ERP deps (React, Vite, Supabase, Radix, Tailwind, etc.). Do not downgrade React or Vite.
- **Add only:** Missing UI libraries that Figma design **strictly** requires (e.g. a specific icon set or chart lib). Prefer aligning to existing stack (e.g. lucide-react, existing charts).
- **Conflict:** If Figma uses a different router or auth layer, **do not** bring that in; adapt Figma UI to use existing NavigationContext and SupabaseProvider.

---

## PART 4 – BUILD SAFETY (after each module)

After each replacement:

1. Run dev server: `npm run dev` (or `dev:no-migrate`).
2. Fix broken imports (paths must stay under `src/app`; no new root).
3. Fix routing: same `currentView` values and same component exports used in App.tsx.
4. No console errors on load and when opening the replaced module.
5. Permissions: still hide/disable by canEditSale, canDeletePurchase, canViewReports, canAccessAccounting, etc.
6. Currency/date: still use `formatCurrency` / `formatDate` (or useFormatCurrency / useFormatDate) everywhere money/dates are shown.

---

## PART 5 – RETURN OUTPUT

### 1. Modules replaced

| Module | Status | Notes |
|--------|--------|-------|
| Layout | **Not yet replaced** | Plan: replace Layout, Sidebar, TopHeader, BottomNav, BranchSelector, GlobalDrawer UI only |
| Dashboard | **Not yet replaced** | Plan: replace Dashboard, StockDashboard, ExpensesDashboard UI |
| Products | **Not yet replaced** | Plan: replace ProductsPage, EnhancedProductForm UI |
| Sales | **Not yet replaced** | Plan: replace SalesPage, SaleForm, ViewSaleDetailsDrawer, ViewPaymentsModal UI |
| Purchases | **Not yet replaced** | Plan: replace PurchasesPage, PurchaseForm, ViewPurchaseDetailsDrawer UI |
| Rentals | **Not yet replaced** | Plan: replace Rental* components UI |
| Studio | **Not yet replaced** | Plan: replace Studio* components UI |
| Reports | **Not yet replaced** | Plan: replace ReportsDashboardEnhanced UI |
| Settings | **Not yet replaced** | Plan: replace SettingsPageNew UI |

**Current state:** Analysis and plan only. No UI replacement has been performed yet.

---

### 2. Files modified

**None.** No restricted or UI files have been changed. This document is the only addition.

**When replacement is done (per module), only these file paths should be modified:**

- `src/app/components/layout/*.tsx`
- `src/app/components/dashboard/*.tsx`
- `src/app/components/products/*.tsx`
- `src/app/components/sales/*.tsx`
- `src/app/components/purchases/*.tsx`
- `src/app/components/rentals/*.tsx`
- `src/app/components/studio/*.tsx`
- `src/app/components/reports/*.tsx`
- `src/app/components/settings/*.tsx`  
and any shared UI they use (e.g. under `src/app/components/ui` or `shared`).  
**App.tsx, main.tsx, context providers, lib/supabase, vite.config, PWA, package.json (except add deps) must not be modified.**

---

### 3. Dependencies added

**None so far.** When merging Figma UI, add a dependency only if a Figma-specific library is strictly required and not already in the project. Prefer existing stack.

---

### 4. Structural conflicts resolved

| Conflict | Resolution |
|----------|------------|
| Figma project has its own App.tsx / routing | **Do not** use Figma’s App or router. Keep single root and NavigationContext; feed Figma UI into existing view components. |
| Figma uses different context names | Keep existing SupabaseContext, SettingsContext, etc. Use them inside the replaced components. |
| Figma has different folder structure | Merge Figma’s JSX/styles into the **existing** file paths under `src/app` so that no imports in App.tsx or layout need to change. |

---

### 5. Risky areas remaining

| Risk | Mitigation |
|------|------------|
| **Lazy-loaded components** | App.tsx uses `lazy()` for SettingsPageNew, ReportsDashboardEnhanced, AccountingDashboard, Studio*, etc. Replacement must keep the **same default export name** and path so `import('./...').then(m => ({ default: m.SettingsPageNew }))` still works. |
| **GlobalDrawer / NavigationContext** | GlobalDrawer and layout depend on `openDrawer`, `setCurrentView`, and optional `setSelectedStudioSaleId` etc. Any new layout must still call these; do not replace context types or provider tree. |
| **POS view** | POS is rendered outside Layout. Do not require Layout for POS. |
| **Module toggles** | App.tsx gates pos, rentals, studio by `modules.*ModuleEnabled`. Settings and layout must continue to expose the same module toggles so this logic remains valid. |
| **Figma bundle differences** | If Figma brings heavy new deps, bundle size may increase; add only what’s strictly needed and prefer existing deps. |

---

## Summary

- **PART 1:** Layout (Layout, Sidebar, TopHeader, BottomNav, BranchSelector, GlobalDrawer), Dashboard, and all modules (Sales, Purchase, Rental, Studio, Reports, Settings, Products, Accounting, Contacts, Inventory) are identified; routing is App.tsx + NavigationContext (`currentView`), no React Router.
- **PART 2:** Replacement order and per-module “replace UI only” rules are defined; Figma UI must be merged into existing files so App.tsx and routing stay unchanged.
- **PART 3:** Keep existing deps; add only strictly required UI libs; do not introduce a new router or auth.
- **PART 4:** After each module: dev server, fix imports/routing, no console errors, permissions and formatCurrency/formatDate intact.
- **PART 5:** No modules replaced yet; no files modified; no dependencies added; conflicts addressed by “adapt Figma to existing structure”; risks listed with mitigations.

**Next step:** Execute replacement in order (Layout → Dashboard → Products → Sales → Purchases → Rentals → Studio → Reports → Settings), one module at a time, without modifying any restricted file.
