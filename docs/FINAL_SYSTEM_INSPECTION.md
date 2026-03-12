# Final System Inspection Report

**Project:** NEW POSV3 (Web ERP + Mobile: erp-mobile-app)  
**Inspection date:** Generated from codebase scan.  
**Scope:** Sales, Purchase, Manufacturing, Courier, Accounting, Mobile POS workflows.

---

## 1. Workflow Verification

### 1.1 Sales Workflow — Customer → Sale → Payment → Invoice

| Step | Status | Location / Notes |
|------|--------|------------------|
| Customer selection | ✅ | Contacts; SaleForm/ViewSaleDetailsDrawer; SalesContext |
| Create sale | ✅ | saleService.createSale; SalesContext.createSale; stock validation (allow negative from settings) |
| Payment | ✅ | recordSalePayment (AccountingContext); saleService; Payment dialog / ViewPaymentsModal |
| Invoice | ✅ | Document numbering (SL-/STD-); print via UnifiedSalesInvoiceView / SaleForm print |
| Accounting | ✅ | SalesContext creates journal (Dr Cash/Bank, Cr Sales Revenue); recordSalePayment for payments |

**APIs:** saleService, saleAccountingService, documentNumberService, quotationService (convert to sale).  
**UI:** SalesPage, SaleForm, ViewSaleDetailsDrawer, PaymentDialog.  
**Routes:** `currentView === 'sales'` (App.tsx).

---

### 1.2 Purchase Workflow — Supplier → Purchase → Payment → Ledger

| Step | Status | Location / Notes |
|------|--------|------------------|
| Supplier | ✅ | Contacts (supplier); PurchaseContext; purchaseService |
| Create purchase | ✅ | purchaseService.createPurchase; PurchaseContext.createPurchase; purchase_items insert |
| Payment | ✅ | purchaseService.recordPayment (status received/final/completed); AccountingContext.recordPurchase |
| Ledger | ✅ | getOrCreateLedger (supplier); addLedgerEntry (purchase + payment); ledgerService |

**APIs:** purchaseService, ledgerService, branchService, documentNumberService.  
**UI:** PurchasesPage, PurchaseForm, ViewPurchaseDetailsDrawer.  
**Routes:** `currentView === 'purchases'`.

---

### 1.3 Manufacturing Workflow — BOM → Production Order → Steps → Inventory

| Step | Status | Location / Notes |
|------|--------|------------------|
| BOM | ✅ | BillOfMaterialsPage (manufacturing-bom); bomService |
| Production order | ✅ | productionOrderService; ProductionOrdersPage (manufacturing-orders) |
| Steps | ✅ | productionStepService; ProductionWorkflow (manufacturing-workflow); workers assignment |
| Inventory | ✅ | productService.createStockMovement (type production); createProductFromProductionOrder (studioCustomerInvoiceService) for finished goods |

**Note:** Manufacturing uses both “manufacturing” (BOM, production orders, steps) and “studio” (Studio Production V2/V3) flows. Studio: studio_production_orders_v2, stages, Job Order → Product → inventory.  
**APIs:** productionOrderService, productionStepService, bomService, productService, studioProductionV2Service, studioCustomerInvoiceService.  
**Routes:** manufacturing-bom, manufacturing-orders, manufacturing-workflow; studio-* for studio production.

---

### 1.4 Courier Workflow — Sale → Packing List → Shipment → Courier → Ledger

| Step | Status | Location / Notes |
|------|--------|------------------|
| Sale | ✅ | Prerequisite; sales with items |
| Packing list | ✅ | packingListService.createFromSale; PackingListWorkflow; packing_lists + packing_list_items |
| Shipment | ✅ | sale_shipments (ShipmentModal, shipmentService) per sale; courier_shipments (CourierShipmentWorkflow, courierShipmentService) per packing list |
| Courier | ✅ | courierService (couriers table); dropdown in ShipmentModal / CourierShipmentWorkflow |
| Ledger | ✅ | shipmentAccountingService (journal for shipment cost/charged); CourierReportsTab; ShipmentLedgerPage, CourierLedgerPanel |

**APIs:** packingListService, courierShipmentService, shipmentService, courierService, shipmentAccountingService.  
**UI:** PackingEntryPage, PackingListWorkflow, CourierShipmentWorkflow, ShipmentModal, ShipmentLedgerPage.  
**Routes:** packing (web); mobile: PackingListModule + ShipmentModal.

---

### 1.5 Accounting Workflow — Payment → Journal → Ledger → Reports

| Step | Status | Location / Notes |
|------|--------|------------------|
| Payment | ✅ | Payments table; recordSalePayment, recordPurchase, recordSupplierPayment, recordWorkerPayment |
| Journal | ✅ | journal_entries + journal_entry_lines; accountingService.createEntry; AccountingContext |
| Ledger | ✅ | accountingService.getAccountLedger; AccountLedgerReportPage; AccountLedgerView |
| Reports | ✅ | accountingReportsService; ReportsDashboardEnhanced; Trial balance, P&L, Day book, etc. |

**APIs:** accountingService, accountService, accountingReportsService.  
**UI:** AccountingDashboard, AccountLedgerView, AccountLedgerReportPage, ReportsDashboardEnhanced.  
**Routes:** accounting, reports.

---

### 1.6 Mobile POS Workflow — Scan barcode → Cart → Payment → Invoice → Sync

| Step | Status | Location / Notes |
|------|--------|------------------|
| Scan barcode | ✅ | BarcodeScanner (camera); keyboard wedge input (Speed-X, Sunmi, CS60); getProductByBarcodeOrSku; AddProducts / POSModule |
| Cart | ✅ | POSModule cart state; add/remove/quantity |
| Payment | ✅ | PaymentDialog; paidAmount/dueAmount; paymentAccountId |
| Invoice | ✅ | salesApi.createSale from POS; invoice number from server |
| Sync | ✅ | Offline: addPending('sale'); online: runSync; registerSyncHandlers sale handler; SyncStatusBar; onSyncClick |

**APIs (mobile):** productsApi.getProductByBarcodeOrSku, salesApi.createSale, offlineStore, syncEngine.  
**UI:** POSModule, PaymentDialog, SyncStatusBar.  
**Screens:** pos (erp-mobile-app).

---

## 2. Critical Issues

| # | Issue | Workflow | Recommendation |
|---|--------|----------|----------------|
| 1 | **Dual sale_items table** | Sales / Packing / Ledger | Codebase uses both `sales_items` and `sale_items` (fallbacks in saleService, packingListService, customerLedgerApi, etc.). Ensure DB has one canonical table or both in sync; document which is primary. |
| 2 | **Mobile build uses tsc -b** | Mobile | Full mobile build runs `tsc -b && vite build`; many pre-existing TS errors in erp-mobile-app. For CI/deploy use `npx vite build` only, or fix TS errors so `tsc -b` passes. |

---

## 3. Warnings

| # | Warning | Area |
|---|---------|------|
| 1 | **Manufacturing vs Studio** | Two production flows (manufacturing BOM/orders vs studio production V2/V3). Ensure team knows which to use for which business case. |
| 2 | **Negative stock** | Sale creation can allow negative stock if setting enabled; purchase/returns can affect stock. Ensure inventory reports and stock checks are consistent. |
| 3 | **Offline sync conflict** | Offline queue syncs in order; no duplicate-invoice retry logic in registerSyncHandlers. If two devices create offline and sync, duplicate invoice numbers possible. Consider idempotency or server-side retry. |
| 4 | **Large main chunk (web)** | Main JS chunk still large after lazy splits. Consider more route-level lazy loading for heavy modules (e.g. Studio, Accounting). |
| 5 | **RLS / branch scope** | Some RPCs (e.g. get_customer_ledger_sales) bypass RLS; others filter by branch. Verify branch filtering on all list/report screens. |

---

## 4. Recommendations

| # | Recommendation | Priority |
|---|----------------|----------|
| 1 | **ERP monitoring** | Add Sentry (or LogRocket) for error tracking and session replay to catch production bugs. |
| 2 | **Unify sale items table** | Prefer single table name (e.g. `sales_items`) and one code path; deprecate the other or keep only for migration. |
| 3 | **Device testing** | Run through `docs/DEVICE_TESTING.md` on Sunmi V2 Pro, Android, iPhone, tablet (barcode, POS, printing, sync). |
| 4 | **Post-deploy smoke** | After deploy: create sale, create purchase, check inventory update, barcode scan, mobile POS, sync. |
| 5 | **VPS deploy** | Use `ssh dincouture-vps` (per project rules); document exact path and steps in PRODUCTION_DEPLOY.md. |

---

## 5. Database / APIs / UI Summary

- **Database:** Supabase (Postgres); migrations in `supabase-extract/migrations` and `migrations/`. Tables: sales, sales_items/sale_items, purchases, purchase_items, journal_entries, journal_entry_lines, packing_lists, packing_list_items, sale_shipments, courier_shipments, couriers, etc.
- **APIs:** All workflows have corresponding services (saleService, purchaseService, packingListService, courierShipmentService, shipmentService, accountingService, etc.). No missing critical APIs identified.
- **UI screens:** Sales, Purchases, Studio, Accounting, Reports, POS (web + mobile), Packing, Shipment modals, Ledger views — all present and routed.
- **Validation:** Stock check on sale (unless negative allowed); purchase payment only when status received/final/completed; document numbering; branch/permission checks on mobile.
- **Performance:** Lazy loading for Dashboard, Reports, Sales, Stock (web); recharts and jspdf in separate chunks. Further lazy splits possible for Studio and Accounting.

---

## 6. Related Docs

- **Device testing:** `docs/DEVICE_TESTING.md` — Sunmi, Android, iPhone, tablet; barcode, POS, printing, sync.
- **Production deploy:** `docs/PRODUCTION_DEPLOY.md` — `npm run deploy:prepare`, VPS (dincouture-vps), mobile build, post-deploy checks.

---

## 7. Sign-Off Checklist (Pre–Production)

- [ ] Decide and document sales_items vs sale_items strategy (if both exist in DB).
- [ ] Run device testing (DEVICE_TESTING.md).
- [ ] Run `npm run deploy:prepare` (or `.\scripts\prepare-deploy.ps1` on Windows).
- [ ] Deploy to VPS; run migrations on prod DB; smoke test.
- [ ] (Optional) Add Sentry/LogRocket for production monitoring.

---

*Report generated from codebase inspection. Re-run inspection after major changes.*
