# Mobile Parity Audit Report

**Scope:** `erp-mobile-app` vs web ERP (`src/app`).  
**Date:** Generated from codebase scan.

---

## Implemented (Mobile has feature)

| Feature | Mobile location | Web equivalent | Notes |
|---------|-----------------|----------------|-------|
| **Sales** | `SalesModule`, `SalesHome`, `AddProducts`, `SaleConfirmation`, `MobileReceivePayment` | SalesPage, SaleForm, ViewPaymentsModal | Create sale, add products, receive payment. |
| **Purchases** | `PurchaseModule`, `CreatePurchaseFlow`, `MobilePaySupplier` | PurchasesPage, PurchaseForm | Create purchase; pay supplier. |
| **Contacts** | `ContactsModule`, `AddContactFlow`, `EditContactFlow`, `ContactDetailView` | ContactsPage, ContactList | Add/edit contacts (customer/supplier). |
| **Products** | `ProductsModule`, `AddProductFlow`, `VariationSelector` | ProductsPage, EnhancedProductForm | Add product; variations. |
| **Inventory** | `InventoryModule`, `InventoryReports` | InventoryDashboardNew, reports | View inventory; reports. |
| **Accounting** | `AccountingModule`, `AccountsDashboard`, `AccountTransferFlow`, `ExpenseEntryFlow`, `WorkerPaymentFlow`, `SupplierPaymentFlow` | AccountingDashboard, ledger, expenses | Accounts, transfers, expenses, worker/supplier payments. |
| **Studio** | `StudioModule`, `StudioDashboard`, `StudioStageSelection` | StudioPipelinePage, StudioDashboardNew | Studio orders; stage selection. |
| **Rental** | `RentalModule`, `RentalPickupModal`, `RentalReturnModal`, `RentalAddPaymentModal` | RentalsPage, PickupModal | Rental flows; pickup/return; payments. |
| **Reports** | `SalesReports`, `AccountReports`, `InventoryReports`, `RentalReports`, `StudioReports`, `WorkerReports`, `ExpenseReports`, `DayBookReport` | ReportsDashboardEnhanced | Multiple report types. |
| **Settings** | `SettingsModule`, `ChangePinModal`, `SetPinModal`, `EmployeesSection`, `UserPermissionsScreen` | SettingsPageNew | PIN, employees, permissions. |
| **Barcode** | `features/barcode` (BarcodeScanner, useBarcodeScanner, barcodeService), `BarcodeCameraModal` | POS, product lookup | Camera scan; hook; service; modal in sales. |
| **Auth** | `LoginScreen`, `BranchSelection` | Auth + branch selection | Login; branch. |
| **Sync** | `SyncStatusBar`, `useNetworkStatus` | N/A (web always online) | Sync status; network awareness. |

---

## Missing (Web has; mobile does not)

| Feature | Web location | Notes |
|---------|-------------|-------|
| **POS (full)** | `POS.tsx` | Web has full POS; mobile has Sales flow but not full POS UI. |
| **Document numbering rules UI** | Settings → Numbering | Maintenance of sequences/rules. |
| **Printing settings** | PrintingSettingsPanel, PrintingPreviewPanel | Paper size, templates. |
| **Courier management** | CourierManagementPanel, ShipmentModal (full) | Courier master; shipment modal parity. |
| **Bulk invoice (wholesale)** | bulkInvoiceService, bulk invoice UI | Create bulk invoice from packing lists. |
| **Packing list generation** | packingListService, packing list UI | Generate packing list from sale. |
| **Manufacturing (BOM / production orders)** | BillOfMaterialsPage, ProductionWorkflow, ProductionOrdersPage | Full BOM and production workflow. |
| **Customer ledger (full)** | CustomerLedgerPage, modern ledger views | Full ledger with filters, print, export. |
| **Rental availability** | RentalDashboard, availability | Rental availability calendar. |

---

## Needs API

| Feature | Required API / RPC | Notes |
|---------|--------------------|-------|
| Barcode → product lookup | Product by SKU/barcode (existing products API may support filter) | Mobile uses barcode; need fast lookup by code. |
| Offline sale submit | Batch submit sales when back online | If offline support added. |
| Sync conflicts | Conflict resolution endpoint | For offline sync. |
| Packing list create | Create packing list from sale (if added to mobile) | Backend may exist; mobile needs endpoint. |
| Bulk invoice create | Bulk invoice from packing lists (if added) | Same. |

---

## Needs UI

| Feature | Current state | Needed |
|---------|---------------|--------|
| Barcode in sales | BarcodeCameraModal in sales | Ensure “Scan” prominent; optional external scanner support. |
| Shipment on sale | Partial | Full shipment modal (courier, tracking) on mobile. |
| Packing list | Missing | Screen to generate/view packing list from sale. |
| Manufacturing | Missing | BOM list; production order list/detail (simplified). |
| Customer ledger | Missing | Read-only ledger view with filters. |

---

## Needs Offline

| Area | Current | Needed |
|------|---------|--------|
| **Data** | Likely online-only (Supabase) | Cache products, contacts, recent sales for offline. |
| **Queue** | None | Queue sales/payments when offline; sync on reconnect. |
| **Sync** | SyncStatusBar shows status | Actual sync logic (upload queue, conflict handling). |
| **Auth** | Online login | Optional: cached session + re-auth when online. |

---

## Summary

- **Implemented:** Sales, purchases, contacts, products, inventory, accounting (core), studio, rental, reports, settings, barcode (camera + hook), auth, sync status.
- **Missing:** Full POS, numbering UI, printing settings, courier management, bulk invoice, packing list UI, manufacturing, full customer ledger, rental availability.
- **Needs API:** Barcode product lookup (verify), offline submit/conflict if offline added.
- **Needs UI:** Barcode prominence, shipment modal, packing list, manufacturing (simplified), customer ledger.
- **Needs offline:** Caching, queue, sync implementation, optional cached auth.
