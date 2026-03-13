# ERP Architecture Audit Report

**Project:** NEW POSV3 ERP  
**Audit Type:** Read-only (no code changes, no refactors)  
**Date:** 2026-03-13  
**Scope:** Database, backend, frontend, services, modules, permissions, accounting, mobile

---

## 1. Executive Summary

The ERP is a **multi-tenant, branch-scoped** system built on **React (Vite)** for web and a separate **React (Vite) mobile app** (Capacitor), both using **Supabase** (PostgreSQL, Auth, Storage, Realtime). Navigation is **view-based** (NavigationContext + `currentView`) rather than URL routes, except for `/admin/permission-inspector` and `/register-contact`. **Permissions** are driven by **role_permissions** (owner/admin/manager/user) with in-memory caching; **module toggles** (POS, Rental, Studio, Accounting) are company-wide and hide entire modules when off. **Accounting** is centralized on **journal_entries** + **journal_entry_lines** + **accounts**; sales, purchases, payments, expenses, refunds, studio, and shipment flows post via **accountingService.createEntry** or AccountingContext. **Mobile** shares the same Supabase backend and permission model (with a screen→module mapping); it has sync/offline hooks and barcode/POS flows. No dedicated AI/automation layer exists in app code beyond **feature_flags** and **automation_rules** table. This audit only inspects and documents; no changes were made.

---

## 2. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Web (React/Vite)                    │  Mobile (React/Vite/Capacitor)         │
│  NavigationContext (currentView)      │  Screen state, BottomNav, ModuleGrid  │
│  Sidebar + MobileNavDrawer           │  Branch selection, SyncStatusBar      │
└────────────────┬────────────────────┴────────────────┬───────────────────────┘
                 │                                      │
                 │  Supabase client (lib/supabase.ts)   │  Same + offline/sync  │
                 ▼                                      ▼                       │
┌─────────────────────────────────────────────────────────────────────────────┐
│  Supabase: PostgreSQL (public schema) │ Auth │ Storage │ Realtime           │
│  RLS per table, role_permissions       │      │         │                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **Single backend:** Supabase project; no separate Node/API server. Business logic lives in **services** (TS) and **RPCs/migrations** (SQL).
- **State:** Contexts (Settings, Navigation, Accounting, Sales, Purchase, Rental, Expense, Production, GlobalFilter, Module) wrap the app; permission and module toggles gate visibility.
- **Reports:** No dedicated report server; reports run in browser via **accountingReportsService**, **dashboardService**, **financialDashboardService**, and direct Supabase queries.

---

## 3. Layer-Wise Architecture

### 3.1 Database Layer

- **PostgreSQL** (Supabase). Public schema: 116+ tables (see DATABASE_AUDIT_REPORT.md).
- **Scoping:** company_id, branch_id on transactional and master data; user_branches for user–branch assignment.
- **Key tables:** companies, branches, users, contacts, products, product_variations, sales, sale_items, purchases, purchase_items, stock_movements, accounts, journal_entries, journal_entry_lines, payments, expenses, studio_productions, studio_production_stages, rentals, role_permissions, modules_config, settings.

### 3.2 SQL / RPC / Migration Layer

- **Migrations:** `migrations/`, `supabase-extract/migrations/` — DDL, RLS policies, triggers, functions.
- **RPCs used by app:** e.g. get_sale_studio_summary, get_studio_stages_for_sale, financial_dashboard_metrics, get_erp_health_dashboard, expense/refund posting, document numbering, has_module_permission-style checks.
- **Triggers:** Auto-post sales to accounting, payment journal creation, stock movements, contact balance updates, sale/purchase totals, document numbers, audit logs.

### 3.3 Backend Service Layer (TypeScript)

- **Location:** `src/app/services/`. No separate API server; services call Supabase from the browser.
- **Examples:** accountService, accountingService, accountingReportsService, contactService, customerLedgerApi, dashboardService, expenseService, inventoryService, ledgerService, packingListService, permissionService, productService, purchaseService, saleService, saleAccountingService, settingsService, shipmentService, shipmentAccountingService, studioProductionService, studioCostsService, rentalService, userService, etc.
- **Accounting entry point:** **accountingService.createEntry(entry, lines, paymentId)** — used by AccountingContext, saleAccountingService, studioProductionService, studioCustomerInvoiceService, shipmentAccountingService, creditNoteService, refundService, SaleReturnForm (reversals).

### 3.4 Frontend UI Layer

- **Framework:** React 18, Vite. UI: Tailwind, shadcn-style components under `components/ui/`.
- **Entry:** `App.tsx` → ProtectedRoute → providers (FeatureFlag, PermissionV2ThemeSync, Supabase, GlobalFilter, Module, Accounting, Settings, Sales, Purchase, Rental, Expense, Production, Navigation) → AppContent.
- **Routing:** View-based. `currentView` from NavigationContext drives which component renders (Dashboard, SalesPage, PurchasesPage, AccountingDashboard, Studio*, Reports, Settings, etc.). Single URL route used: `/admin/permission-inspector`, and `/register-contact` for public registration.

### 3.5 State / Context Layer

- **SettingsContext:** Company, branch, user, modules (module toggles), featureFlags, currentUser (permissions), numbering, loadAllSettings (loads role_permissions via permissionEngine).
- **NavigationContext:** currentView, setCurrentView, drawer state.
- **AccountingContext:** createEntry, refreshEntries, getEntriesByReference, getEntriesBySource; wraps accountingService and drives manual entries, payments, expenses, refunds, studio worker payments, advances, etc.
- **SalesContext, PurchaseContext, RentalContext, ExpenseProvider, ProductionContext:** Module-specific state and actions.
- **GlobalFilterContext:** Date range / global filters for reports and lists.
- **ModuleContext:** Module availability (from settings).

### 3.6 Permissions Layer

- **Source of truth:** **role_permissions** (role, module, action, allowed). Roles: owner, admin, manager, user.
- **Loading:** SettingsContext → permissionEngine.loadPermissions(userId, companyId, engineRole, role) → getRolePermissions(engineRole) with in-memory cache.
- **UI:** useCheckPermission() → hasPermission('module.action') (e.g. sales.view, accounting.view). Sidebar and module visibility use hasPermission and module toggles.
- **RLS:** Many tables have RLS policies (sales, purchases, contacts, stock_movements, journal_entries, accounts, studio_*, etc.); policies use role and user_branches/company scope. See migrations/*rls*.sql.

### 3.7 Reporting Layer

- **No separate report server.** Reports run in the browser via:
  - accountingReportsService (journal-based: day book, P&L, balance sheet, etc.)
  - dashboardService (sales by category)
  - financialDashboardService (metrics, sometimes RPC)
  - Direct Supabase selects in report components (e.g. DayBookReport, SalesProfitPage, CustomerProfitability).
- **Data:** journal_entries, journal_entry_lines, accounts, sales, sale_items/sales_items, purchases, stock_movements, contacts.

### 3.8 Mobile Layer

- **App:** `erp-mobile-app/` — React, Vite, Capacitor. Separate build; same Supabase backend.
- **Navigation:** Screen state (login, branch-selection, home, dashboard, sales, purchase, rental, studio, accounts, expense, inventory, products, pos, contacts, reports, packing, ledger, settings). BottomNav + ModuleGrid; permission and module toggles hide tiles.
- **APIs:** `erp-mobile-app/src/api/*.ts` — auth, branches, contacts, products, sales, purchases, rentals, studio, accounts, expenses, inventory, reports, permissions, settings, shipments, packingList, documentNumber, etc. These call Supabase (and sometimes RPCs) directly.
- **Permissions:** PermissionContext uses getRolePermissions + getUserBranchIds + getModuleConfigs; hasPermission(module, action) and isModuleEnabled(screen). Screen→module mapping in permissionModules.ts (e.g. accounts→ledger, expense→payments).
- **Sync/offline:** syncEngine, offlineStore, useNetworkStatus; SyncStatusBar. No full offline DB; sync is for pending operations / status.

### 3.9 Automation / AI Integration Layer

- **Automation:** DB table **automation_rules** (accounting-related); no app-level automation engine observed in code.
- **AI:** No OpenAI/LLM or AI-specific integration found in src/ or erp-mobile-app/.
- **Feature flags:** feature_flags table and featureFlagsService; used for studio_production_v2/v3, permission_v2, etc.

---

## 4. Module-Wise Architecture

(See ERP_MODULE_MAP.md for the concise module-by-module breakdown.)

- **Dashboard:** dashboardService (sales by category), financial metrics; Dashboard component.
- **Sales:** SalesPage, SaleForm, ViewSaleDetailsDrawer; saleService, saleAccountingService, quotationService, saleReturnService, creditNoteService, refundService; sales, sale_items/sales_items, payments, journal_entries. Accounting: trigger + SaleContext/accountingService.
- **Purchases:** PurchasesPage, PurchaseForm; purchaseService; purchases, purchase_items; accounting via context/service.
- **Inventory:** InventoryDesignTestPage, StockDashboard, AdjustStockDialog; inventoryService, productService; stock_movements, inventory_balance, products, product_variations.
- **Accounting:** AccountingDashboard, AccountLedgerView, ManualEntryDialog; accountingService, accountService, accountingReportsService; accounts, journal_entries, journal_entry_lines. Central hub for all posting.
- **Expenses:** ExpensesDashboard; expenseService; expenses; posting via AccountingContext/createEntry or RPC.
- **Payments:** UnifiedPaymentDialog, payment flows in AccountingContext; payments table; journal entries via createEntry or triggers.
- **Contacts:** ContactsPage, ViewContactProfile; contactService; contacts. Used by sales, purchases, ledger.
- **Studio Production:** StudioDashboardNew, StudioSalesListNew, StudioPipelinePage, StudioWorkflowPage; studioProductionService, studioCostsService, studioCustomerInvoiceService; studio_productions, studio_production_stages, workers, worker_ledger_entries. Accounting: createEntry for stage costs and worker payments.
- **Rentals:** RentalDashboard, NewRentalBooking; rentalService; rentals, rental_items, rental_payments. Accounting: advance/rental income via AccountingContext.
- **Reports:** ReportsDashboardEnhanced; accountingReportsService, dashboardService; journal + sales + purchases data.
- **Settings:** SettingsPageNew; settingsService, branchService, userService, permissionService, numberingMaintenanceService; settings, companies, branches, users, role_permissions, modules_config.
- **Users/Permissions:** UserDashboard, ErpPermissionArchitecturePage, UserPermissionsTab; userService, permissionService; users, user_branches, role_permissions.
- **Mobile ERP:** Same backend; separate screens and api/*.ts; PermissionContext; barcode (features/barcode), POS (POSModule), inventory, payments (MobileReceivePayment, PaySupplier, etc.).
- **POS:** POS component; uses sales/products/contacts/payments; same accounting as sales.
- **Manufacturing:** BillOfMaterialsPage, ProductionOrdersPage, ProductionWorkflow; bomService, productionOrderService, productionStepService; bill_of_materials, production_orders, production_steps.
- **Shipping/Courier:** PackingEntryPage, shipment services; sale_shipments, packing_lists, couriers; shipmentAccountingService posts journal entries.

---

## 5. Dependency Graph Summary

(See ERP_DEPENDENCY_GRAPH.md for full chains.)

- **Sales** → contacts, products, product_variations, stock (for availability), payments, accounting (journal), document_sequences, branches.
- **Purchases** → contacts (suppliers), products, stock_movements, accounting, branches.
- **Inventory** → products, product_variations, stock_movements, inventory_balance; optionally branches.
- **Accounting** → accounts, journal_entries, journal_entry_lines; consumed by sales, purchases, payments, expenses, refunds, studio, rentals, shipment.
- **Studio** → sales (sale_id), contacts (workers), studio_productions, studio_production_stages, workers, worker_ledger_entries, accounting.
- **Reports** → accounting (journal), sales, purchases, contacts, stock.
- **Mobile** → same core APIs and permissions; depends on auth, branches, role_permissions, modules_config.

---

## 6. Permission Architecture Review

- **Strength:** Single table **role_permissions**; in-memory cache per role; unified hasPermission('module.action') on web; mobile uses same backend and same role_permissions with screen→module mapping. Module toggles (company-wide) consistently hide POS/Rental/Studio/Accounting when disabled.
- **Checks:** Permission loaded once in SettingsContext (loadAllSettings); useCheckPermission reads from currentUser. Repeated calls are in-memory (no per-click DB). Sidebar and AppContent both use hasPermission for visibility.
- **Mismatch risk:** Web uses modules like **accounting** (role_permissions may use **ledger**); mobile maps **accounts** screen to **ledger**. Expense on mobile maps to **payments** module. Ensure role_permissions.module values (sales, purchase, ledger, payments, rentals, studio, etc.) stay aligned with both web and mobile mapping.
- **RLS:** Extensive; per-table policies for company/branch/role. Some modules have visibility scope (view_own, view_branch, view_company). Backend enforcement is via RLS; frontend gating is for UX only.

---

## 7. Accounting Architecture Review

- **Central entry point:** **accountingService.createEntry(entry, lines, paymentId)**. Inserts journal_entries + journal_entry_lines; optional payment_id link.
- **Who posts:**
  - **Sales:** DB trigger (trigger_auto_post_sale_to_accounting) and/or SaleContext/saleAccountingService.
  - **Purchases:** PurchaseContext / purchaseService (journal creation on confirm).
  - **Payments:** Triggers and/or AccountingContext (receive payment, pay supplier, worker payment, etc.).
  - **Expenses:** AccountingContext.createEntry (expense entry flow); expenseService may use RPC.
  - **Refunds / sale returns:** refundService, SaleReturnForm — createEntry for reversals.
  - **Studio:** studioProductionService, studioCustomerInvoiceService — createEntry for stage costs and customer invoice; worker payments sync to worker_ledger_entries.
  - **Shipment:** shipmentAccountingService — createEntry for shipping income/expense/courier payable.
  - **Credit notes:** creditNoteService — createEntry.
- **Balance:** check_journal_entries_balance() exists; no DB trigger enforcing balance (allows multi-line insert). Reports use journal_entry_lines joined to journal_entries and accounts.
- **Risks:** Dual paths (accounts vs chart_accounts, journal vs ledger_master/ledger_entries) documented in DATABASE_AUDIT_REPORT.md. Ensure all transactional modules post through accountingService or documented RPCs so nothing bypasses the central journal.

---

## 8. Performance Architecture Review

- **Dashboard:** Loads company/branch, then dashboard metrics and sales-by-category (dashboardService); multiple Supabase calls. No obvious heavy join in a single query; could be optimized with a single RPC or materialized view.
- **Permission checks:** Cached in memory (getRolePermissions); no repeated DB for hasPermission after load.
- **Repeated fetch patterns:** Some list pages fetch full detail per row (e.g. sale list then per-sale details); consider list endpoints with minimal fields and lazy detail.
- **Heavy joins:** accountingReportsService and report components join journal_entry_lines → journal_entries → accounts over date range; indexes on (company_id, entry_date) and journal_entry_id on lines are important (see DATABASE_AUDIT_REPORT.md).
- **Caching:** Permission cache only; no HTTP or query result caching observed. Settings/modules loaded once per session.
- **Expensive RPCs:** financial_dashboard_metrics and similar; ensure they are indexed and bounded by company_id/branch_id/date.

---

## 9. Mobile Architecture Review

- **APIs:** 26 api/*.ts files; mirror web services (contacts, products, sales, purchases, rentals, studio, accounts, expenses, inventory, reports, permissions, settings, branches, documentNumber, packingList, shipments, etc.). Shared backend; some logic duplicated (e.g. permission module names, screen mapping).
- **Permissions parity:** Same role_permissions; FEATURE_MOBILE_PERMISSION_V2 gates full permission + branch + module toggles. Screen→module mapping (permissionModules.ts) must match backend module names (e.g. ledger, payments, purchase).
- **Barcode/POS/Inventory/Payment:** features/barcode (useBarcodeScanner, barcodeService); POSModule; InventoryModule; MobileReceivePayment, PaySupplier, WorkerPaymentFlow, ExpenseEntryFlow, GeneralEntryFlow. Flows call same Supabase tables and RPCs as web.
- **Offline/cache:** offlineStore, syncEngine, getUnsyncedCount/runSync; SyncStatusBar. Not full offline DB; sync for pending actions and status.

---

## 10. Risks, Gaps, and Next Recommendations

- **Risks:** (1) sales_items vs sale_items dual naming in code and DB. (2) chart_accounts vs accounts and ledger_master/ledger_entries vs journal — clarify canonical path and deprecate or document. (3) Mobile module names (ledger, payments, purchase) must stay aligned with role_permissions. (4) No backend enforcement of permission in RPCs beyond RLS — ensure all RPCs respect company_id/branch_id and RLS.
- **Gaps:** (1) No dedicated report server or cached aggregates; all report queries run in browser. (2) No AI/automation layer in app. (3) Offline mobile is limited to sync status, not full offline DB. (4) URL routing is minimal; deep links only for permission-inspector and register-contact.
- **Recommendations:** (1) Standardize on sale_items or sales_items and one chart (accounts vs chart_accounts). (2) Document which modules post to accounting and how (triggers vs createEntry vs RPC). (3) Add a single dashboard RPC or view to reduce round-trips. (4) Keep permission screen→module map in sync with role_permissions and web. (5) Consider read-only report API or cached materialized views for heavy reports.

---

*End of audit. No code or schema was modified.*
