# ERP Module Map

Read-only module-by-module breakdown. **Status:** active = production-ready and in use; **partial** = implemented but incomplete or feature-flagged; **legacy** = present but superseded or being phased out.

---

## Dashboard

| Field | Detail |
|-------|--------|
| **Purpose** | Company/branch KPIs, revenue, sales by category |
| **Tables** | sales, sale_items/sales_items, products, product_categories; optional RPC (financial_dashboard_metrics) |
| **Services** | dashboardService, financialDashboardService |
| **Screens/Components** | Dashboard (web) |
| **Dependencies** | Settings (company/branch), Sales data |
| **Status** | **active** |

---

## Sales

| Field | Detail |
|-------|--------|
| **Purpose** | Invoices, quotations, sale returns, credit notes, refunds |
| **Tables** | sales, sale_items, sales_items, sale_charges, sale_returns, sale_return_items, quotations, quotation_items, credit_notes, refunds, payments, document_sequences / erp_document_sequences |
| **Services** | saleService, saleAccountingService, quotationService, saleReturnService, creditNoteService, refundService, customerLedgerApi |
| **Screens/Components** | SalesPage, SaleForm, ViewSaleDetailsDrawer, QuotationWorkflow, SaleReturnForm, StandaloneSaleReturnForm |
| **Accounting impact** | Trigger (trigger_auto_post_sale_to_accounting) and/or saleAccountingService → accountingService.createEntry; refunds/returns post reversals |
| **Dependencies** | contacts, products, product_variations, stock (availability), payments, accounting, branches |
| **Status** | **active** |

---

## Purchases

| Field | Detail |
|-------|--------|
| **Purpose** | Purchase orders, receive goods, purchase returns |
| **Tables** | purchases, purchase_items, purchase_charges, purchase_returns, purchase_return_items |
| **Services** | purchaseService, purchaseReturnService |
| **Screens/Components** | PurchasesPage, PurchaseForm, PurchaseReturnForm, StandalonePurchaseReturnForm |
| **Accounting impact** | Journal entries on confirm/post via context/service |
| **Dependencies** | contacts (suppliers), products, inventory (stock_movements), accounting, branches |
| **Status** | **active** |

---

## Inventory

| Field | Detail |
|-------|--------|
| **Purpose** | Stock levels, movements, adjustments, transfers |
| **Tables** | stock_movements, inventory_balance, products, product_variations, product_categories, brands, units |
| **Services** | inventoryService, productService, productCategoryService, brandService, unitService |
| **Screens/Components** | InventoryDesignTestPage, StockDashboard, InventoryDashboardNew, AdjustStockDialog, StockTransferDrawer |
| **Accounting impact** | Stock adjustments can post journal entries (e.g. stock_adjustment reference_type) |
| **Dependencies** | products, product_variations, branches |
| **Status** | **active** |

---

## Accounting

| Field | Detail |
|-------|--------|
| **Purpose** | Chart of accounts, journal entries, manual entries, account ledger, reports |
| **Tables** | accounts, journal_entries, journal_entry_lines, payments (reference) |
| **Services** | accountingService, accountService, accountingReportsService |
| **Screens/Components** | AccountingDashboard, AccountLedgerView, ManualEntryDialog, StudioCostsTab, CustomerLedgerComponents |
| **Accounting impact** | Central: all posting flows use accountingService.createEntry or RPCs that write to journal_entries/lines |
| **Dependencies** | None (core); consumed by sales, purchases, payments, expenses, studio, rentals, shipment |
| **Status** | **active** |

---

## Expenses

| Field | Detail |
|-------|--------|
| **Purpose** | Record and categorize expenses; post to accounting |
| **Tables** | expenses, expense_categories, accounts |
| **Services** | expenseService, expenseCategoryService |
| **Screens/Components** | ExpensesDashboard |
| **Accounting impact** | AccountingContext.createEntry or expense RPC posts to journal_entries |
| **Dependencies** | accounting (accounts), payments (payment account) |
| **Status** | **active** |

---

## Payments

| Field | Detail |
|-------|--------|
| **Purpose** | Receive customer payments, pay suppliers, worker payments, advances; link to sales/purchases/rentals |
| **Tables** | payments, journal_entries, journal_entry_lines, sales, purchases |
| **Services** | accountingService (via AccountingContext), customerLedgerApi |
| **Screens/Components** | UnifiedPaymentDialog, payment flows inside AccountingContext (receive, pay supplier, worker, advance) |
| **Accounting impact** | createEntry for each payment; some DB triggers also create journal entries |
| **Dependencies** | accounting, contacts, sales/purchases/rentals (reference_type/reference_id) |
| **Status** | **active** |

---

## Contacts (Customers / Suppliers)

| Field | Detail |
|-------|--------|
| **Purpose** | Customers, suppliers, workers; contact ledger (customer balance) |
| **Tables** | contacts, contact_groups; ledger via sales/payments (customer) or ledger_master/ledger_entries (supplier/user) |
| **Services** | contactService, contactGroupService, customerLedgerApi, ledgerService |
| **Screens/Components** | ContactsPage, ViewContactProfile, ContactList |
| **Accounting impact** | No direct posting; balances derived from sales/payments and ledger_entries |
| **Dependencies** | None (master); used by sales, purchases, studio (workers), ledger |
| **Status** | **active** |

---

## Studio Production

| Field | Detail |
|-------|--------|
| **Purpose** | Productions linked to sales; stages, workers, costs; worker payments |
| **Tables** | studio_productions, studio_production_stages, workers, worker_ledger_entries, worker_payments; optional v2/v3 tables |
| **Services** | studioProductionService, studioCostsService, studioCustomerInvoiceService, studioProductionInvoiceSyncService |
| **Screens/Components** | StudioDashboardNew, StudioSalesListNew, StudioPipelinePage, StudioWorkflowPage, StudioSaleDetailNew, StudioProductionV2/V3* |
| **Accounting impact** | createEntry for stage costs and customer invoice; worker payments sync to worker_ledger_entries |
| **Dependencies** | sales (sale_id), contacts (workers), accounting |
| **Status** | **active** (v2/v3 feature-flagged; base studio_productions/stages canonical) |

---

## Rentals

| Field | Detail |
|-------|--------|
| **Purpose** | Rental bookings, items, payments, returns |
| **Tables** | rentals, rental_items, rental_payments |
| **Services** | rentalService, rentalAvailabilityService |
| **Screens/Components** | RentalDashboard, NewRentalBooking, RentalOrdersList, ReturnTodayTab |
| **Accounting impact** | Advances and rental income via AccountingContext.createEntry |
| **Dependencies** | contacts, products (rentable), accounting |
| **Status** | **active** (gated by rentalModuleEnabled) |

---

## Reports

| Field | Detail |
|-------|--------|
| **Purpose** | Day book, P&L, balance sheet, sales profit, customer profitability, inventory/product reports |
| **Tables** | journal_entries, journal_entry_lines, accounts, sales, sale_items, purchases, stock_movements, contacts |
| **Services** | accountingReportsService, dashboardService, financialDashboardService |
| **Screens/Components** | ReportsDashboardEnhanced, DayBookReport, SalesProfitPage, CustomerProfitability, ProductLedger, etc. |
| **Accounting impact** | Read-only consumer of accounting and transaction data |
| **Dependencies** | accounting, sales, purchases, inventory, contacts |
| **Status** | **active** |

---

## Settings

| Field | Detail |
|-------|--------|
| **Purpose** | Company/branch config, module toggles, numbering, POS, users, permissions |
| **Tables** | companies, branches, settings, modules_config, users, user_branches, role_permissions, erp_document_sequences, document_sequences |
| **Services** | settingsService, branchService, userService, permissionService, numberingMaintenanceService, globalSettingsService |
| **Screens/Components** | SettingsPageNew, NumberingMaintenanceTable, UserPermissionsTab, AddBranchModal |
| **Accounting impact** | None |
| **Dependencies** | None (core) |
| **Status** | **active** |

---

## Users / Permissions

| Field | Detail |
|-------|--------|
| **Purpose** | User list, role assignment, role_permissions matrix |
| **Tables** | users, user_branches, role_permissions |
| **Services** | userService, permissionService, permissionInspectorService |
| **Screens/Components** | UserDashboard, AddUserModal, ErpPermissionArchitecturePage, MatrixTab, UserPermissionsTab |
| **Accounting impact** | None |
| **Dependencies** | Settings (company), Auth (Supabase) |
| **Status** | **active** |

---

## POS

| Field | Detail |
|-------|--------|
| **Purpose** | Point-of-sale: quick sales, barcode, payments |
| **Tables** | sales, sale_items, products, product_variations, contacts, payments |
| **Services** | saleService, productService, contactService (walk-in customer) |
| **Screens/Components** | POS (web), POSModule (mobile) |
| **Accounting impact** | Same as Sales (trigger + accounting) |
| **Dependencies** | contacts, products, inventory, payments, accounting |
| **Status** | **active** (gated by posModuleEnabled) |

---

## Mobile ERP

| Field | Detail |
|-------|--------|
| **Purpose** | Same ERP flows on mobile: sales, purchase, rental, studio, accounts, expense, inventory, products, POS, contacts, reports, packing, ledger, settings |
| **Tables** | Same as web (shared Supabase) |
| **Services** | erp-mobile-app/src/api/* (26 files) — wrap Supabase and RPCs |
| **Screens/Components** | LoginScreen, BranchSelection, HomeScreen, ModuleGrid, SalesModule, PurchaseModule, RentalModule, StudioModule, AccountsModule, ExpenseModule, InventoryModule, ProductsModule, POSModule, ContactsModule, ReportsModule, PackingListModule, LedgerModule, SettingsModule, DashboardModule |
| **Accounting impact** | Same backend; mobile creates sales, payments, expenses, etc., which post via same triggers/services |
| **Dependencies** | Auth, branches, role_permissions, modules_config; same as web for data |
| **Status** | **active** (permission and module parity with web) |

---

## Shipping / Courier / Packing

| Field | Detail |
|-------|--------|
| **Purpose** | Sale shipments, packing lists, bulk invoices, courier ledger |
| **Tables** | sale_shipments, packing_lists, packing_list_items, bulk_invoices, bulk_invoice_items, couriers, courier_shipments |
| **Services** | shipmentService, shipmentAccountingService, packingListService, bulkInvoiceService, courierService, courierShipmentService |
| **Screens/Components** | PackingEntryPage, ShipmentLedgerPage, CourierShipmentWorkflow (wholesale) |
| **Accounting impact** | shipmentAccountingService.createEntry for shipping income/expense/courier payable |
| **Dependencies** | sales, accounting |
| **Status** | **active** |

---

## Manufacturing (BOM / Production Orders)

| Field | Detail |
|-------|--------|
| **Purpose** | Bill of materials, production orders, production steps |
| **Tables** | bill_of_materials, production_orders, production_steps |
| **Services** | bomService, productionOrderService, productionStepService |
| **Screens/Components** | BillOfMaterialsPage, ProductionOrdersPage, ProductionWorkflow |
| **Accounting impact** | Not observed in audit; may be partial |
| **Dependencies** | products |
| **Status** | **partial** |

---

## Ledger (Supplier / User ledgers)

| Field | Detail |
|-------|--------|
| **Purpose** | Supplier and user (non-customer) ledgers; opening balance |
| **Tables** | ledger_master, ledger_entries |
| **Services** | ledgerService, ledgerDataAdapters |
| **Screens/Components** | Used from Accounting / Contacts flows; customer ledger via customerLedgerApi (sales/payments) |
| **Accounting impact** | Separate from journal_entries; some flows may sync to worker_ledger_entries |
| **Dependencies** | contacts |
| **Status** | **active** (supplier/user); customer ledger is sales/payments based |

---

## Developer / Test Pages

| Field | Detail |
|-------|--------|
| **Purpose** | Permission inspector, ledger tests, RLS validation, integration tests, cutover prep |
| **Tables** | Various (read-only or test data) |
| **Services** | permissionInspectorService, testAccountingService, etc. |
| **Screens/Components** | PermissionInspectorPage, CustomerLedgerTestPage, LedgerDebugTestPage, RLSValidationPage, ERPIntegrationTestBlockPage, CutoverPrepPage, etc. |
| **Status** | **active** (dev only; gated by settings.view) |

---

*End of module map. No code changed.*
