# 02 — Modules and Screen Map

## Permission screen → DB module mapping

From [`erp-mobile-app/src/utils/permissionModules.ts`](../../erp-mobile-app/src/utils/permissionModules.ts):

| Mobile `Screen` | `role_permissions.module` | Notes |
|-----------------|---------------------------|-------|
| `sales` | `sales` | |
| `purchase` | `purchase` | singular in DB |
| `pos` | `pos` | |
| `rental` | `rentals` | |
| `studio` | `studio` | |
| `accounts` | `ledger` | Accounts UI uses ledger module |
| `expense` | `payments` | no `expenses` module in mobile map |
| `products` | `inventory` | |
| `inventory` | `inventory` | |
| `contacts` | `contacts` | |
| `reports` | `reports` | |
| `packing` | `sales` | wholesale/shipment workflow |
| `ledger` | `ledger` | customer ledger read-only |
| `settings` | `settings` | skips module.view gate in shell |
| `dashboard` | `reports` | |
| `home` | `reports` | home always shown; grid filtered |

Gate pattern: `hasPermission('{module}.view')` or visibility scope actions (`view_own`, `view_branch`, `view_company`).

## Company module toggles (`modules_config`)

Mobile reads subset in [`api/settings.ts`](../../erp-mobile-app/src/api/settings.ts): `rentals`, `studio`, `accounting`, `production`, `pos`, `combos`.

`PermissionContext.isModuleEnabled()` gates:

| Screen | Toggle key |
|--------|------------|
| `rental` | `rentalModuleEnabled` |
| `studio` | `studioModuleEnabled` |
| `pos` | `posModuleEnabled` |
| `accounts` | `accountingModuleEnabled` |

Web has fuller registry in [`src/app/config/companyBootstrapRegistry.ts`](../../src/app/config/companyBootstrapRegistry.ts) (`salesModuleEnabled`, `purchasesModuleEnabled`, etc.). Flutter should load web-equivalent toggles for parity when gating nav.

## Master module table

| Module | Existing screen / file | Main actions | Flutter screen(s) | Priority | Notes |
|--------|------------------------|--------------|-------------------|----------|-------|
| **Auth** | [`LoginScreen.tsx`](../../erp-mobile-app/src/components/LoginScreen.tsx), [`CreateBusinessWizardScreen.tsx`](../../erp-mobile-app/src/components/auth/CreateBusinessWizardScreen.tsx), [`POSLockScreen.tsx`](../../erp-mobile-app/src/components/auth/POSLockScreen.tsx), [`SwitchUserPinOverlay.tsx`](../../erp-mobile-app/src/components/auth/SwitchUserPinOverlay.tsx) | Email/password login, Google OAuth, create business, device PIN, counter worker login | `AuthLoginScreen`, `BranchSelectionScreen`, `CreateBusinessWizard`, `CounterLockScreen` | P0 | API: [`api/auth.ts`](../../erp-mobile-app/src/api/auth.ts), [`api/business.ts`](../../erp-mobile-app/src/api/business.ts) |
| **Dashboard** | [`dashboard/DashboardModule.tsx`](../../erp-mobile-app/src/components/dashboard/DashboardModule.tsx) | Period metrics, charts, quick stats | `DashboardScreen` | P1 | RPC: `get_dashboard_metrics`, `get_financial_dashboard_metrics` |
| **Contacts** | [`contacts/ContactsModule.tsx`](../../erp-mobile-app/src/components/contacts/ContactsModule.tsx), [`EditContactFlow.tsx`](../../erp-mobile-app/src/components/contacts/EditContactFlow.tsx) | List, search, filter, add/edit, lead approval, balances | `ContactsListScreen`, `ContactDetailScreen`, `ContactFormScreen` | P1 | API: [`api/contacts.ts`](../../erp-mobile-app/src/api/contacts.ts), [`contactBalancesRpc.ts`](../../erp-mobile-app/src/api/contactBalancesRpc.ts) |
| **Products** | [`products/ProductsModule.tsx`](../../erp-mobile-app/src/components/products/ProductsModule.tsx), [`AddProductFlow.tsx`](../../erp-mobile-app/src/components/products/AddProductFlow.tsx), [`PrintBarcodeLabelModal.tsx`](../../erp-mobile-app/src/components/products/PrintBarcodeLabelModal.tsx) | CRUD, variations, categories, barcode labels | `ProductsListScreen`, `ProductFormScreen`, `BarcodeLabelScreen` | P1 | API: [`api/products.ts`](../../erp-mobile-app/src/api/products.ts) |
| **Inventory** | [`inventory/InventoryModule.tsx`](../../erp-mobile-app/src/components/inventory/InventoryModule.tsx) | Stock levels, adjustments, transfers | `InventoryDashboardScreen`, `StockAdjustmentScreen` | P2 | API: [`api/inventory.ts`](../../erp-mobile-app/src/api/inventory.ts) |
| **Sales** | [`sales/SalesModule.tsx`](../../erp-mobile-app/src/components/sales/SalesModule.tsx), [`SelectCustomer.tsx`](../../erp-mobile-app/src/components/sales/SelectCustomer.tsx), [`PaymentDialog.tsx`](../../erp-mobile-app/src/components/sales/PaymentDialog.tsx), [`SaleReturnModal.tsx`](../../erp-mobile-app/src/components/sales/SaleReturnModal.tsx) | Draft/quotation/order/final, returns, studio sales, charges | `SalesListScreen`, `SaleFormScreen`, `SaleDetailScreen`, `SaleReturnScreen` | P0 | API: [`api/sales.ts`](../../erp-mobile-app/src/api/sales.ts) |
| **POS** | [`pos/POSModule.tsx`](../../erp-mobile-app/src/components/pos/POSModule.tsx), [`BarcodeCameraModal.tsx`](../../erp-mobile-app/src/components/sales/BarcodeCameraModal.tsx) | Product grid, cart, barcode scan, checkout | `PosScreen`, `PosCartSheet` | P0 | Same sales API; offline queue |
| **Payments** | [`PaymentDialog.tsx`](../../erp-mobile-app/src/components/sales/PaymentDialog.tsx), [`accounts/AccountsModule.tsx`](../../erp-mobile-app/src/components/accounts/AccountsModule.tsx) tabs | Receive/pay, manual receipt, allocations | `PaymentFormScreen`, `ManualReceiptScreen` | P0 | RPC: `record_payment_with_accounting` in [`api/accounts.ts`](../../erp-mobile-app/src/api/accounts.ts), [`api/sales.ts`](../../erp-mobile-app/src/api/sales.ts) |
| **Rentals** | [`rental/RentalModule.tsx`](../../erp-mobile-app/src/components/rental/RentalModule.tsx), [`RentalCalendarTab.tsx`](../../erp-mobile-app/src/components/rental/RentalCalendarTab.tsx) | Booking, calendar, payment, return, devaluation | `RentalListScreen`, `RentalBookingScreen`, `RentalCalendarScreen` | P2 | API: [`api/rentals.ts`](../../erp-mobile-app/src/api/rentals.ts), [`rentalBookingAccounting.ts`](../../erp-mobile-app/src/api/rentalBookingAccounting.ts) |
| **Purchases** | [`purchase/PurchaseModule.tsx`](../../erp-mobile-app/src/components/purchase/PurchaseModule.tsx), [`SelectSupplierTablet.tsx`](../../erp-mobile-app/src/components/purchase/SelectSupplierTablet.tsx) | Create, finalize, void, returns, supplier payment | `PurchaseListScreen`, `PurchaseFormScreen` | P2 | API: [`api/purchases.ts`](../../erp-mobile-app/src/api/purchases.ts) |
| **Studio** | [`studio/StudioModule.tsx`](../../erp-mobile-app/src/components/studio/StudioModule.tsx), worker/job components | Pipeline stages, assign worker, receive, payments | `StudioDashboardScreen`, `StudioPipelineScreen`, `WorkerJobScreen` | P2 | API: [`api/studio.ts`](../../erp-mobile-app/src/api/studio.ts), [`studioFinalizeAfterInvoice.ts`](../../erp-mobile-app/src/api/studioFinalizeAfterInvoice.ts) |
| **Expenses** | [`expense/ExpenseModule.tsx`](../../erp-mobile-app/src/components/expense/ExpenseModule.tsx) | Add expense, categories, GL post | `ExpenseListScreen`, `ExpenseFormScreen` | P2 | API: [`api/expenses.ts`](../../erp-mobile-app/src/api/expenses.ts) |
| **Accounting** | [`accounts/AccountsModule.tsx`](../../erp-mobile-app/src/components/accounts/AccountsModule.tsx) | Manual JE, funds transfer, roznamcha, transaction edit | `AccountingHomeScreen`, `ManualEntryScreen`, `FundsTransferScreen` | P2 | API: [`api/accounts.ts`](../../erp-mobile-app/src/api/accounts.ts), [`api/roznamcha.ts`](../../erp-mobile-app/src/api/roznamcha.ts) |
| **Ledger** | Ledger tab in Accounts, [`partyGlLedger.ts`](../../erp-mobile-app/src/api/partyGlLedger.ts) | Customer/supplier GL ledger, party balances | `PartyLedgerScreen` | P2 | RPC: `get_customer_ar_gl_ledger_for_contact`, `get_supplier_ap_gl_ledger_for_contact` |
| **Reports** | [`accounts/reports/*`](../../erp-mobile-app/src/components/accounts/reports/), [`api/reports.ts`](../../erp-mobile-app/src/api/reports.ts) | P&L, trial balance, aging, product reports | `ReportsHubScreen`, report sub-screens | P3 | Embeds many report components |
| **Settings** | [`settings/SettingsModule.tsx`](../../erp-mobile-app/src/components/settings/SettingsModule.tsx), [`SettingsPrinterSection.tsx`](../../erp-mobile-app/src/components/settings/SettingsPrinterSection.tsx) | Company, users, printer, modules, PIN, logout | `SettingsScreen`, nested setting sheets | P1 | API: [`api/settings.ts`](../../erp-mobile-app/src/api/settings.ts), [`api/employees.ts`](../../erp-mobile-app/src/api/employees.ts) |
| **Packing** | [`packing/PackingListModule.tsx`](../../erp-mobile-app/src/components/packing/PackingListModule.tsx) | Packing lists, shipment sync | `PackingListScreen` | P3 | API: [`api/packingList.ts`](../../erp-mobile-app/src/api/packingList.ts), [`shipmentAccounting.ts`](../../erp-mobile-app/src/api/shipmentAccounting.ts) |
| **Bespoke** | [`sales/SaleBespokeWorkOrders.tsx`](../../erp-mobile-app/src/components/sales/SaleBespokeWorkOrders.tsx) | Work orders on sales | Post-MVP or P3 | API: [`api/bespokeWorkOrders.ts`](../../erp-mobile-app/src/api/bespokeWorkOrders.ts) |

## API module index (62 files)

Primary reference directory: [`erp-mobile-app/src/api/`](../../erp-mobile-app/src/api/).

Grouped by domain:

- **Core transactional:** `sales.ts`, `purchases.ts`, `rentals.ts`, `expenses.ts`, `contacts.ts`, `products.ts`, `inventory.ts`
- **Accounting:** `accounts.ts`, `roznamcha.ts`, `partyGlLedger.ts`, `customerLedger.ts`, `contactBalancesRpc.ts`, `partySubledger.ts`
- **Studio:** `studio.ts`, `studioFinalizeAfterInvoice.ts`, `studioStockLifecycle.ts`, `myWorkerDashboard.ts`
- **Platform:** `auth.ts`, `branches.ts`, `permissions.ts`, `settings.ts`, `documentNumber.ts`, `business.ts`, `employees.ts`
- **Logistics:** `packingList.ts`, `shipments.ts`, `courierShipments.ts`, `shipmentAccounting.ts`

## Shell components (shared)

| Component | Path | Flutter equivalent |
|-----------|------|-------------------|
| Home | [`HomeScreen.tsx`](../../erp-mobile-app/src/components/HomeScreen.tsx) | `HomeScreen` with module grid |
| Bottom nav | [`BottomNav.tsx`](../../erp-mobile-app/src/components/BottomNav.tsx) | `NavigationBar` |
| Module grid | [`ModuleGrid.tsx`](../../erp-mobile-app/src/components/ModuleGrid.tsx) | Drawer / more sheet |
| Tablet sidebar | [`TabletSidebar.tsx`](../../erp-mobile-app/src/components/TabletSidebar.tsx) | `NavigationRail` @ 768px+ |
| Sync bar | [`SyncStatusBar.tsx`](../../erp-mobile-app/src/components/SyncStatusBar.tsx) | `SyncStatusBanner` |
| Offline banner | [`common/OfflineBanner.tsx`](../../erp-mobile-app/src/components/common/OfflineBanner.tsx) | connectivity banner |
| Access denied | [`AccessDenied.tsx`](../../erp-mobile-app/src/components/AccessDenied.tsx) | permission empty state |
| Pull refresh | [`common/PullToRefresh.tsx`](../../erp-mobile-app/src/components/common/PullToRefresh.tsx) | `RefreshIndicator` |
