# 00 — Master System Map

**Last updated:** 2026-04-12
**App:** NEWPOSV3 (Din Couture ERP)
**Stack:** Next.js 14, Supabase (PostgreSQL + RLS), TypeScript

---

## 1. System Overview

NEWPOSV3 is a multi-tenant ERP built on Next.js with a Supabase backend. Every row in every business table is scoped to a `company_id` (multi-tenant isolation). Routing is **view-based**: there is no URL router driving page changes. Instead, a single `NavigationContext` holds a `currentView` string; `App.tsx` conditionally renders the matching component. This means deep-links, browser back/forward, and URL-sharing are intentionally not supported — all navigation is internal state.

Key architectural decisions:
- **No URL router.** All navigation is `setCurrentView(view)` calls on `NavigationContext`.
- **Supabase RLS** enforces company isolation at the database level (every table has a `company_id` policy).
- **Provider hierarchy** controls data loading order; inner providers can safely depend on outer ones.
- **Feature flags** are stored in two separate systems: a DB table (`feature_flags`, company-scoped) for Studio/production features, and a `localStorage` key (`erp_feature_permission_v2`) for the permissions UI toggle.
- **Settings** are loaded once per session in `SettingsProvider` and distributed via context; all modules read from `useSettings()`.

---

## 2. Provider / Context Hierarchy

Listed outer-to-inner. Each inner provider can call hooks from any provider above it.

| # | Provider | File | State Managed |
|---|----------|------|---------------|
| 1 | `FeatureFlagProvider` | `src/app/context/FeatureFlagContext.tsx` | `permissionV2: boolean` — drives enterprise permission UI. Reads/writes `localStorage` key `erp_feature_permission_v2`. Default: `true` (from `src/app/config/featureFlags.ts`). |
| 2 | `SupabaseProvider` | `src/app/context/SupabaseContext.tsx` | Auth session, `user`, `companyId`, `branchId`, Supabase client reference. The root of all authenticated state. |
| 3 | `ProtectedRoute` | (inline in App layout) | Guards unauthenticated access; redirects to login if no session. |
| 4 | `GlobalFilterProvider` | `src/app/context/GlobalFilterContext.tsx` | Global date range filter (today/last7days/last30days/etc.), branch filter (`branchId`), current module label. Persists to `localStorage` key `erp-global-filters`. |
| 5 | `ModuleProvider` | `src/app/context/ModuleContext.tsx` | Legacy module toggles for rentals, manufacturing, repairs, loyalty, accounting. Persists to `localStorage` key `erp_modules`. Note: superseded for most cases by `ModuleToggles` inside `SettingsContext`. |
| 6 | `AccountingProvider` | `src/app/context/AccountingContext.tsx` | Journal entries, GL accounts list, accounting summaries. Used by Accounting page and AR/AP pages. |
| 7 | `SettingsProvider` | `src/app/context/SettingsContext.tsx` | All company settings (CompanySettings, POSSettings, SalesSettings, PurchaseSettings, InventorySettings, RentalSettings, AccountingSettings), branch list, numbering rules, payment method config, module toggles (ModuleToggles), feature flags (DB-backed), current user permissions (UserPermissions), permission-loaded gate. |
| 8 | `SalesProvider` | `src/app/context/SalesContext.tsx` | Current sale form state, sale list cache, active sale line items. |
| 9 | `PurchaseProvider` | `src/app/context/PurchaseContext.tsx` | Current purchase form state, purchase list cache. |
| 10 | `RentalProvider` | `src/app/context/RentalContext.tsx` | Rental bookings, rental form, rental item states. |
| 11 | `ExpenseProvider` | `src/app/context/ExpenseContext.tsx` | Expense list, expense categories, current expense form. |
| 12 | `ProductionProvider` | `src/app/context/ProductionContext.tsx` | Studio/manufacturing production orders, production stage state. |
| 13 | `NavigationProvider` | `src/app/context/NavigationContext.tsx` | `currentView: View`, `setCurrentView`, drawer state, party ledger params. The entire routing layer. |

`ErrorBoundary` wraps the innermost rendered content inside `NavigationProvider`.

---

## 3. Module Inventory

| Module / Section | View ID(s) | Primary Component | Primary Service(s) |
|-----------------|-----------|-------------------|-------------------|
| Dashboard | `dashboard` | `DashboardPage` | `dashboardService`, `financialDashboardService` |
| Products | `products` | `ProductsPage` | `productService`, `brandService`, `productCategoryService`, `unitService`, `variationMasterService` |
| POS | `pos` | `POSPage` (guarded: `posModuleEnabled`) | `saleService`, `productService`, `defaultAccountsService` |
| Sales | `sales` | `SalesPage` | `saleService`, `saleAccountingService`, `paymentAllocationService` |
| Sale Returns | (drawer/modal within sales) | `SaleReturnForm` | `saleReturnService`, `saleAccountingService` |
| Purchases | `purchases` | `PurchasesPage` | `purchaseService`, `purchaseAccountingService`, `purchaseReturnService` |
| Purchase Returns | (drawer/modal within purchases) | `PurchaseReturnForm` | `purchaseReturnService`, `purchaseAccountingService` |
| Contacts / CRM | `contacts`, `contact-profile` | `ContactsPage`, `ViewContactProfile` | `contactService`, `publicContactService`, `contactGroupService`, `partySubledgerAccountService` |
| Accounting / Journal | `accounting` | `AccountingPage` | `accountingService`, `accountService`, `journalTransactionDateSyncService`, `openingBalanceJournalService` |
| AR/AP Reconciliation | `ar-ap-reconciliation-center` | `ArApReconciliationCenterPage` | `arApReconciliationCenterService`, `arApRepairWorkflowService`, `arApTruthLabService` |
| Party Ledger | `party-ledger` | `PartyLedgerPage` | `customerLedgerApi`, `effectivePartyLedgerService`, `partyFormBalanceService` |
| Reports | `reports` | `ReportsPage` | `accountingReportsService`, `commissionReportService`, `roznamchaService`, `inventoryIntelligenceService` |
| Rentals | `rentals`, `rental-booking` | `RentalsPage`, `NewRentalBooking` | `rentalService`, `rentalAvailabilityService` |
| Studio / Production | `studio`, `studio-dashboard-new`, `studio-sales-list-new`, `studio-pipeline`, `studio-sale-detail-new`, `studio-order-detail-v3` | Various Studio components | `studioService`, `studioProductionV3Service`, `studioProductionV3InvoiceService`, `studioCostsService`, `studioCustomerInvoiceService`, `studioProductionInvoiceSyncService` |
| Expenses | `expenses` | `ExpensesDashboard` | `expenseService`, `expenseCategoryService` |
| Inventory / Stock | `stock`, `inventory` | `StockPage`, `InventoryPage` | `inventoryService`, `documentStockSyncService`, `inventoryIntelligenceService` |
| Users | `users` | `UsersPage` | `userService`, `permissionService` |
| Roles / Permissions | `roles`, `erp-permissions` | `RolesPage`, `ErpPermissionsPage` | `permissionService`, `permissionEngine`, `permissionInspectorService` |
| Settings | `settings` | `SettingsPage` | `settingsService`, `branchService`, `defaultAccountsService`, `printingSettingsService`, `globalSettingsService` |
| Shipments / Packing | `packing` | `PackingEntryPage` | `packingListService`, `shipmentService`, `courierService`, `courierShipmentService`, `shipmentAccountingService` |
| Manufacturing | `manufacturing-bom`, `manufacturing-orders`, `manufacturing-workflow` | `ManufacturingBomPage`, `ManufacturingOrdersPage`, `ManufacturingWorkflowPage` | `bomService`, `productionOrderService`, `productionStepService` |
| Worker / Payroll | `worker-detail` | `WorkerDetailPage` | `workerAdvanceService`, `workerPaymentService`, `employeeService` |

---

## 4. Complete Route / View Table

All views are defined in `src/app/context/NavigationContext.tsx` and rendered in `src/app/App.tsx`.

| View ID | Component | Service(s) | Access Guard |
|---------|-----------|------------|--------------|
| `dashboard` | `DashboardPage` | `dashboardService`, `financialDashboardService` | Authenticated |
| `products` | `ProductsPage` | `productService`, `brandService`, `productCategoryService` | Authenticated |
| `pos` | `POSPage` | `saleService`, `productService` | `posModuleEnabled` |
| `sales` | `SalesPage` | `saleService`, `saleAccountingService` | Authenticated |
| `purchases` | `PurchasesPage` | `purchaseService`, `purchaseAccountingService` | Authenticated |
| `rentals` | `RentalsPage` | `rentalService`, `rentalAvailabilityService` | `rentalModuleEnabled` |
| `rental-booking` | `NewRentalBooking` | `rentalService` | `rentalModuleEnabled` |
| `stock` | `StockPage` | `inventoryService` | Authenticated |
| `inventory` | `InventoryPage` | `inventoryService`, `inventoryIntelligenceService` | Authenticated |
| `studio` | `StudioPage` | `studioService` | `studioModuleEnabled` |
| `studio-dashboard-new` | `StudioDashboardNew` | `studioProductionV3Service` | `studioModuleEnabled` |
| `studio-sales-list-new` | `StudioSalesListNew` | `studioProductionV3Service` | `studioModuleEnabled` |
| `studio-pipeline` | `StudioPipelinePage` | `studioProductionV3Service` | `studioModuleEnabled` |
| `studio-sale-detail` | `StudioSaleDetail` | `studioProductionV3Service` | `studioModuleEnabled` |
| `studio-sale-detail-new` | `StudioSaleDetailNew` | `studioProductionV3Service`, `studioProductionV3InvoiceService` | `studioModuleEnabled` |
| `studio-order-detail-v3` | `StudioOrderDetailV3` | `studioProductionV3Service`, `studioCostsService` | `studioModuleEnabled` |
| `studio-workflow` | `StudioWorkflowPage` | `studioProductionV3Service` | `studioModuleEnabled` |
| `studio-production-list` | `StudioProductionListPage` | `studioProductionService` | `studioModuleEnabled` |
| `studio-production-add` | `StudioProductionAddPage` | `studioProductionService` | `studioModuleEnabled` |
| `studio-production-detail` | `StudioProductionDetailPage` | `studioProductionService` | `studioModuleEnabled` |
| `manufacturing-bom` | `ManufacturingBomPage` | `bomService` | `studioModuleEnabled` |
| `manufacturing-orders` | `ManufacturingOrdersPage` | `productionOrderService` | `studioModuleEnabled` |
| `manufacturing-workflow` | `ManufacturingWorkflowPage` | `productionStepService` | `studioModuleEnabled` |
| `expenses` | `ExpensesDashboard` | `expenseService`, `expenseCategoryService` | Authenticated |
| `contacts` | `ContactsPage` | `contactService`, `contactGroupService` | Authenticated |
| `contact-profile` | `ViewContactProfile` | `contactService`, `partySubledgerAccountService` | Authenticated |
| `accounting` | `AccountingPage` | `accountingService`, `accountService` | `accountingModuleEnabled` |
| `ar-ap-reconciliation-center` | `ArApReconciliationCenterPage` | `arApReconciliationCenterService` | `accountingModuleEnabled` |
| `party-ledger` | `PartyLedgerPage` | `customerLedgerApi`, `effectivePartyLedgerService` | Authenticated |
| `users` | `UsersPage` | `userService`, `permissionService` | `canManageUsers` |
| `roles` | `RolesPage` | `permissionService` | `canManageUsers` |
| `erp-permissions` | `ErpPermissionsPage` | `permissionService`, `permissionEngine` | `canManageUsers` |
| `user-profile` | `UserProfilePage` | `userService` | Authenticated |
| `reports` | `ReportsPage` | `accountingReportsService`, `roznamchaService` | `canViewReports` |
| `settings` | `SettingsPage` | `settingsService`, `branchService` | `canManageSettings` |
| `packing` | `PackingEntryPage` | `packingListService`, `shipmentService`, `courierService` | Authenticated |
| `item-report` | `ItemLifecycleReport` | `inventoryService` | Authenticated |
| `production-detail` | `ProductionOrderDetail` | `productionOrderService` | Authenticated |
| `worker-detail` | `WorkerDetailPage` | `workerAdvanceService`, `workerPaymentService` | Authenticated |
| `customer-tracking` | `CustomerOrderTracking` | `contactService`, `saleService` | Authenticated |
| `permission-inspector` | `PermissionInspectorPage` | `permissionInspectorService` | Admin only |
| `accounting-integrity-lab` | `AccountingIntegrityLabPage` | `accountingIntegrityLabService`, `integrityLabService` | Admin/Developer |
| `developer-integrity-lab` | `DeveloperIntegrityLabPage` | `developerAccountingDiagnosticsService` | Admin/Developer |
| `ar-ap-truth-lab` | `ArApTruthLabPage` | `arApTruthLabService`, `truthLabTraceWorkbenchService` | Admin/Developer |
| `rls-validation` | `RLSValidationPage` | (test harness) | Developer |
| `cutover-prep` | `CutoverPrepPage` | (migration tools) | Developer |

---

## 5. Database Table Inventory

### Business / Multi-tenant

| Table | Purpose |
|-------|---------|
| `companies` | One row per tenant. Holds business name, currency, fiscal year start, business type, `modules_config` (JSONB). |
| `branches` | Physical locations/branches under a company. Holds `company_id`, name, code, address, `default_cash_account_id`, `default_bank_account_id`, `default_pos_drawer_account_id`, `is_active`. |
| `feature_flags` | Per-company feature toggles. PK is `(company_id, feature_key)`. Missing row = disabled. |

### Users / Auth

| Table | Purpose |
|-------|---------|
| `users` | Public users table (mirrors Supabase Auth). Holds `company_id`, `branch_id`, role, full name. |
| `user_branches` | Many-to-many: which branches a user may access. Used in RESTRICTED branch access mode. |
| `role_permissions` | Per-company RBAC rules. Maps role → permission key → boolean. |

### Products / Inventory

| Table | Purpose |
|-------|---------|
| `products` | Master product/item catalog. `company_id`-scoped. |
| `product_variations` | SKU-level variants (size, color, etc.) under a product. |
| `stock_movements` | Every stock-in / stock-out event with source doc reference. |
| `inventory_balance` | Running balance per product/variation/branch. Denormalized for fast lookup. |

### Sales

| Table | Purpose |
|-------|---------|
| `sales` | Sale header (invoice). Holds customer, branch, total, status, payment status. |
| `sales_items` / `sales_products` | Line items on a sale. |
| `sale_charges` | Additional charges per sale (shipping, handling, etc.). |
| `sale_returns` | Return-against-sale header. |
| `sale_return_items` | Line items on a return. |

### Purchases

| Table | Purpose |
|-------|---------|
| `purchases` | Purchase header. Holds supplier, branch, total, status. |
| `purchase_items` | Line items on a purchase. |
| `purchase_charges` | Additional charges per purchase. |
| `purchase_returns` | Return-against-purchase header. |
| `purchase_return_items` | Line items on a purchase return. |

### Rentals

| Table | Purpose |
|-------|---------|
| `rentals` | Rental booking header. Holds customer, dates, status, deposit. |
| `rental_items` | Items included in a rental booking. |
| `rental_payments` | Payments made against a rental. |

### Studio / Production

| Table | Purpose |
|-------|---------|
| `studio_production_orders_v3` | Studio order header (v3 schema). Holds customer, status, production stages. |
| `studio_production_stages_v3` | Individual production stages per order. |
| `studio_production_cost_breakdown_v3` | Cost breakdown entries per order. |

### Accounting / GL

| Table | Purpose |
|-------|---------|
| `accounts` | Chart of accounts. Holds `company_id`, `code`, `name`, `type`, `parent_id`, `is_group`, `is_active`. Party-linked accounts have a `contact_id`. |
| `journal_entries` | Journal entry header. Has `action_fingerprint` (idempotency), `source_type` (sale/purchase/etc.), `source_id`, `is_locked`. |
| `journal_entry_lines` | Debit/credit lines. Each line has `account_id`, `debit`, `credit`. |
| `payment_allocations` | Links payments to invoices (AR/AP allocation). |

### Expenses

| Table | Purpose |
|-------|---------|
| `expenses` | Expense record header. Holds category, amount, date, payment account. |
| `expense_categories` | User-defined expense category list. |

### Workers

| Table | Purpose |
|-------|---------|
| `worker_ledger_entries` | Per-worker debit/credit ledger entries. |
| `worker_payments` | Cash/bank payments made to workers. |

### Contacts / CRM

| Table | Purpose |
|-------|---------|
| `contacts` | Customers, suppliers, and other parties. `company_id`-scoped. Holds type (customer/supplier/both), contact_group. |

### Sequences / Numbering

| Table | Purpose |
|-------|---------|
| `erp_document_sequences` | Per-company, per-branch, per-document-type numbering sequence. |
| `document_sequences_global` | Fallback global sequence table used before per-branch sequences were introduced. |

---

## 6. Service File Map

117 service files total under `src/app/services/`. Grouped by domain:

### Business / Tenant Setup
| File | Description |
|------|-------------|
| `businessService.ts` | Creates a new company via `supabase.auth.signUp` then `create_business_transaction` RPC. |
| `branchService.ts` | CRUD for branches; auto-generates branch codes; triggers COA seed and walk-in customer after branch creation. |
| `defaultAccountsService.ts` | Seeds the full Chart of Accounts (groups + leaves) for a company; idempotent; repairs parent_id links. |
| `settingsService.ts` | Reads and writes all company settings (modules, numbering, POS, sales, purchase, rental, accounting). |
| `globalSettingsService.ts` | Company-level global settings operations (currency, fiscal year, timezone). |
| `featureFlagsService.ts` | Company-scoped feature flag get/set. Keys: `studio_production_v2`, `studio_production_v3`, `studio_customer_invoice_v1`. |

### Products / Inventory
| File | Description |
|------|-------------|
| `productService.ts` | Full CRUD for products and variations. |
| `brandService.ts` | Product brand master. |
| `productCategoryService.ts` | Product category tree. |
| `unitService.ts` | Unit of measure master. |
| `variationMasterService.ts` | Variation attribute templates (size, color). |
| `comboService.ts` | Combo/bundle product management. |
| `inventoryService.ts` | Stock query and movement recording. |
| `inventoryIntelligenceService.ts` | Analytics: slow-moving stock, reorder alerts. |
| `documentStockSyncService.ts` | Syncs stock movements when a sale/purchase is posted or reversed. |

### Sales
| File | Description |
|------|-------------|
| `saleService.ts` | Sale CRUD, status transitions, payment recording. |
| `saleAccountingService.ts` | Posts/reverses journal entries for sales and sale returns. |
| `saleReturnService.ts` | Sale return CRUD. |
| `quotationService.ts` | Quotation / proforma invoice management. |
| `cancellationService.ts` | Cancels a sale and reverses its accounting/stock. |
| `creditNoteService.ts` | Issues credit notes against sale returns. |
| `refundService.ts` | Cash/bank refund against a credit note. |
| `bulkInvoiceService.ts` | Batch invoice generation (e.g. for studio orders). |
| `invoiceDocumentService.ts` | PDF/print payload construction for invoices. |
| `effectiveDocumentService.ts` | Resolves which document (sale vs return vs credit note) is the "effective" one for ledger display. |

### Purchases
| File | Description |
|------|-------------|
| `purchaseService.ts` | Purchase CRUD, GRN, supplier payment recording. |
| `purchaseAccountingService.ts` | Posts/reverses journal entries for purchases. |
| `purchaseReturnService.ts` | Purchase return CRUD. |
| `supplierPaymentService.ts` | Supplier payment lifecycle (advance, invoice settlement). |

### Contacts / CRM
| File | Description |
|------|-------------|
| `contactService.ts` | Contact CRUD; creates default Walk-in Customer on company setup. |
| `publicContactService.ts` | Public-facing contact registration (self-registration link). |
| `contactGroupService.ts` | Contact group/tag management. |
| `partySubledgerAccountService.ts` | Creates/links party-specific AR/AP subledger accounts in the COA. |

### Accounting / GL
| File | Description |
|------|-------------|
| `accountService.ts` | Chart of accounts CRUD. |
| `accountHelperService.ts` | Utility helpers for account lookups and type checks. |
| `accountingService.ts` | Journal entry CRUD, GL query. |
| `addEntryV2Service.ts` | Manual journal entry posting (V2 form). |
| `accountingReportsService.ts` | Trial balance, P&L, balance sheet queries. |
| `paymentAllocationService.ts` | AR/AP allocation (link payments to invoices). |
| `openingBalanceJournalService.ts` | Posts opening balances on account creation. |
| `journalTransactionDateSyncService.ts` | Ensures journal entry dates match source transaction dates. |
| `documentPostingEngine.ts` | Central posting engine: converts a document (sale/purchase/expense) into journal lines. |
| `accountingIntegrityService.ts` | Integrity checks: JE balance, orphan lines, double-postings. |
| `accountingIntegrityLabService.ts` | Extended integrity lab checks (AR/AP tie-out, COA structure). |
| `accountingCanonicalGuard.ts` | Guards canonical JEs from manual edits (source-owned protection). |
| `accountingDisplayRefResolver.ts` | Resolves display references (doc number, party name) for JE lines. |
| `fullAccountingAuditService.ts` | Full accounting audit sweep across all documents. |
| `testAccountingService.ts` | Test/dev accounting helper (not used in production flows). |
| `developerAccountingDiagnosticsService.ts` | Developer-facing diagnostic queries for accounting state. |
| `chartAccountService.ts` | COA tree builder (grouping + hierarchy). |
| `accountHierarchyAuditService.ts` | Audits parent_id chains in COA for loops/orphans. |
| `controlAccountBreakdownService.ts` | Breaks down AR/AP control account balance by party. |
| `shipmentAccountingService.ts` | Posts courier/shipment charges to accounting. |

### AR / AP Reconciliation
| File | Description |
|------|-------------|
| `arApReconciliationCenterService.ts` | AR/AP reconciliation center queries and repair triggers. |
| `arApRepairWorkflowService.ts` | Automated repair workflow for AR/AP mismatches. |
| `arApTruthLabService.ts` | Deep truth-lab analysis of AR/AP balance vs ledger. |
| `partyBalanceTieOutService.ts` | Ties out party balance (ledger vs allocation). |
| `partyTieOutRepairService.ts` | Repairs party tie-out discrepancies. |
| `partyTieOutBulkCleanupService.ts` | Bulk cleanup for party tie-out issues. |
| `contactBalanceReconciliationService.ts` | Contact-level balance reconciliation (AR/AP per contact). |
| `partyFormBalanceService.ts` | Computes form-level balance for party ledger display. |
| `truthLabTraceWorkbenchService.ts` | Trace workbench for deep AR/AP transaction tracing. |

### Payments
| File | Description |
|------|-------------|
| `paymentLifecycleService.ts` | Full payment lifecycle (create, allocate, reverse). |
| `paymentAdjustmentService.ts` | Adjusts payment amounts (debit/credit notes). |
| `paymentChainMutationGuard.ts` | Prevents mutation of payment chains that have downstream allocations. |
| `paymentChainCompositeReversal.ts` | Reverses a composite payment chain atomically. |

### Rentals
| File | Description |
|------|-------------|
| `rentalService.ts` | Rental booking CRUD, status transitions, payment recording. |
| `rentalAvailabilityService.ts` | Item availability check for rental date ranges. |

### Studio / Production
| File | Description |
|------|-------------|
| `studioService.ts` | Studio order CRUD (legacy V1). |
| `studioProductionService.ts` | Studio production order management (V1/V2 bridge). |
| `studioProductionV2Service.ts` | Studio production V2 schema operations. |
| `studioProductionV3Service.ts` | Studio production V3 schema operations (current). |
| `studioProductionV3InvoiceService.ts` | Invoice generation from V3 production orders. |
| `studioProductionInvoiceSyncService.ts` | Syncs studio order status to linked sales invoice. |
| `studioCustomerInvoiceService.ts` | Customer-facing invoice for studio orders. |
| `studioCostsService.ts` | Cost breakdown per production order. |

### Manufacturing
| File | Description |
|------|-------------|
| `bomService.ts` | Bill of materials CRUD. |
| `productionOrderService.ts` | Manufacturing production order lifecycle. |
| `productionStepService.ts` | Production step/stage management within an order. |

### Expenses
| File | Description |
|------|-------------|
| `expenseService.ts` | Expense CRUD and accounting posting. |
| `expenseCategoryService.ts` | Expense category CRUD. |

### Workers / Payroll
| File | Description |
|------|-------------|
| `workerAdvanceService.ts` | Worker advance issuance and recovery. |
| `workerPaymentService.ts` | Worker wage/payment recording. |
| `employeeService.ts` | Employee/worker profile management. |

### Shipments / Packing
| File | Description |
|------|-------------|
| `shipmentService.ts` | Shipment creation and tracking. |
| `packingListService.ts` | Packing list (box/piece) management. |
| `courierService.ts` | Courier master data. |
| `courierShipmentService.ts` | Links a courier to a shipment with tracking info. |

### Users / Permissions
| File | Description |
|------|-------------|
| `userService.ts` | User CRUD, branch assignment, role assignment. |
| `permissionService.ts` | Role-permission matrix fetch and evaluation. |
| `permissionEngine.ts` | Permission evaluation engine (applies role rules to a user action). |
| `permissionInspectorService.ts` | Developer tool: inspects effective permissions for a user/role. |

### Reporting / Ledger
| File | Description |
|------|-------------|
| `roznamchaService.ts` | Day-book / Roznamcha (daily cash summary) report. |
| `financialDashboardService.ts` | Dashboard KPIs: revenue, expense, profit, receivables. |
| `commissionReportService.ts` | Commission/sales agent report. |
| `customerLedgerApi.ts` | Customer-level ledger query API. |
| `customerLedgerTypes.ts` | TypeScript types for customer ledger rows. |
| `ledgerDataAdapters.ts` | Adapters to normalize ledger rows from different sources. |
| `effectivePartyLedgerService.ts` | Computes the effective party ledger (sales + returns + payments net). |

### Integrity / Audit / Repair
| File | Description |
|------|-------------|
| `integrityRuleEngine.ts` | Rule engine for data integrity checks. |
| `integrityIssueRepository.ts` | Persists detected integrity issues for review. |
| `integrityLabService.ts` | Runs integrity checks and returns issue list. |
| `liveDataRepairService.ts` | Applies live repairs to detected data issues. |
| `postingDuplicateRepairService.ts` | Detects and removes duplicate JE postings. |
| `auditLogService.ts` | Appends to audit log for sensitive operations. |
| `activityLogService.ts` | User activity log (who did what, when). |

### Documents / Sharing / Print
| File | Description |
|------|-------------|
| `documentShareService.ts` | Generates shareable links for invoices/documents. |
| `pdfExportService.ts` | PDF export for invoices, reports, packing lists. |
| `printingSettingsService.ts` | Per-company print template and thermal printer settings. |
| `invoiceDocumentService.ts` | Constructs the data payload for invoice rendering. |

### Utilities / Misc
| File | Description |
|------|-------------|
| `dashboardService.ts` | Dashboard summary queries. |
| `healthService.ts` | DB health check (used in startup or status pages). |
| `backupService.ts` | Data export/backup utilities. |
| `githubService.ts` | GitHub integration (deploy notes, version info). |
| `numberingMaintenanceService.ts` | Repairs gaps or resets in document numbering sequences. |
| `documentNumberService.ts` | Next-number generation for any document type. |

---

## 7. Feature Flag System

There are two separate feature flag layers in this system:

### Layer 1 — Client-side flag: `permissionV2` (localStorage)

- **File:** `src/app/config/featureFlags.ts`, `src/app/context/FeatureFlagContext.tsx`
- **Storage:** `localStorage` key `erp_feature_permission_v2`
- **Default:** `true` (constant `FEATURE_PERMISSION_V2 = true` in `featureFlags.ts`)
- **Effect:** When `true`, enables the enterprise permissions UI tab in Settings and the `ErpPermissionsPage` view.
- **Runtime override:** Any component can call `setPermissionV2(false)` to disable for the session.
- **Safe fallback:** `useFeatureFlagOptional()` returns `permissionV2: true` when used outside the provider (e.g. in test pages), so the tab always shows.

### Layer 2 — DB-backed flags: `feature_flags` table (company-scoped)

- **File:** `src/app/services/featureFlagsService.ts`
- **Table:** `feature_flags` — columns: `company_id`, `feature_key`, `enabled`, `description`
- **Constraint:** Unique on `(company_id, feature_key)`
- **Default behaviour:** Missing row = feature disabled (safe default).
- **Known keys:**

| Feature Key | Constant | Effect |
|-------------|----------|--------|
| `studio_production_v2` | `FEATURE_KEYS.STUDIO_PRODUCTION_V2` | Enables Studio Production V2 UI and service layer. |
| `studio_production_v3` | `FEATURE_KEYS.STUDIO_PRODUCTION_V3` | Enables Studio Production V3 (current production UI). |
| `studio_customer_invoice_v1` | `FEATURE_KEYS.STUDIO_CUSTOMER_INVOICE_V1` | Enables customer invoice generation from studio orders. |

### Layer 3 — Module toggles in SettingsContext (`ModuleToggles`)

- **File:** `src/app/context/SettingsContext.tsx`
- **Stored in:** `companies.modules_config` JSONB column (DB-persisted, company-scoped)
- **Manages:** `rentalModuleEnabled`, `studioModuleEnabled`, `accountingModuleEnabled`, `productionModuleEnabled`, `posModuleEnabled`, `combosEnabled`
- **Enforcement:** `App.tsx` checks these flags before rendering guarded views. For example: accessing `pos` when `posModuleEnabled = false` shows an "upgrade / enable module" screen.

### Legacy Layer — `ModuleContext` (localStorage)

- **File:** `src/app/context/ModuleContext.tsx`
- **Storage:** `localStorage` key `erp_modules`
- **Modules tracked:** `rentals`, `manufacturing`, `repairs`, `loyalty`, `accounting`
- **Status:** Largely superseded by `ModuleToggles` in `SettingsContext`. Some older components may still reference this context.

---

## 8. Known Cross-cutting Concerns

### 8.1 — `action_fingerprint` Idempotency on `journal_entries`

Every journal entry written by the posting engine carries an `action_fingerprint` field — a deterministic hash derived from the source document ID, document type, and action type (e.g. `sale:abc123:post`). Before inserting a JE, the engine checks whether a row with the same fingerprint already exists. If it does, the insert is skipped. This prevents double-posting when a user retries a failed operation or when a network timeout causes a retry. Any code that posts a JE **must** pass a fingerprint; posts without one bypass the guard and are logged as a warning.

### 8.2 — Source-owned JE Protection

Journal entries created by the system on behalf of a source document (sale, sale return, purchase, purchase return) have `source_type` and `source_id` set. The `accountingCanonicalGuard.ts` service enforces that these JEs **cannot be edited or deleted** from the manual Journal Entry page. Attempts to do so throw a guard error. Only the originating module's service layer (e.g. `saleAccountingService`) may reverse or update these entries — and only by posting a full reversal JE, not by mutating the original.

### 8.3 — Multi-tenant Isolation: `company_id` on Every Row

Every business table has a `company_id` column. Supabase Row Level Security (RLS) policies enforce that authenticated users can only read/write rows where `company_id` matches their own company. This is enforced at the DB level independent of application code. The `SupabaseContext` extracts `companyId` from the authenticated user's JWT claims and passes it to all services. Every service query `.eq('company_id', companyId)` is an application-layer redundancy on top of RLS.

### 8.4 — Party Subledger Account Linking

The `accounts` table supports party-linked accounts for AR and AP. When a new customer or supplier contact is created (or first transacted with), `partySubledgerAccountService` creates (or locates) a dedicated account row for that party under the AR (code `1100`) or AP (code `2000`) control account. The contact's `id` is stored on the account row. This enables per-party ledger views and balance tie-out. The `arApReconciliationCenterService` uses these links to verify that the sum of party subledger balances equals the control account balance.

### 8.5 — Branch Access Modes

`branchService` exposes `getCompanyBranchCount()`. If a company has exactly one active branch, the system operates in `AUTO` mode: the single branch is auto-assigned to every transaction without prompting the user. If there are two or more branches, the system is in `RESTRICTED` mode: users must have explicit access via `user_branches` and must select a branch in the UI (via `GlobalFilterContext.branchId`). The `GlobalFilterProvider` persists the selected branch to `localStorage` key `erp-global-filters`.

### 8.6 — Document Numbering Sequences

Document numbers (SL-0001, PUR-0001, etc.) are generated via `settingsService.getNextDocumentNumber()`, which reads from `erp_document_sequences`. Each sequence is scoped to `(company_id, branch_id, document_type)`. There is a fallback to `document_sequences_global` for older companies created before per-branch sequences were introduced. The `numberingMaintenanceService` can repair gaps. Prefixes are configurable per company in `NumberingRules` (stored in company settings).

### 8.7 — Walk-in Customer

When a branch is created, `branchService.createBranch()` calls `contactService.createDefaultWalkingCustomer(company_id)`. This ensures there is always a "Walk-in Customer" contact at the company level, used as the default customer for POS transactions. The function is idempotent — it checks for existence before inserting.
