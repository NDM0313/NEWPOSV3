# ERP Workflow Map

Generated from codebase analysis. Key entry points: `src/app/components`, `src/app/services`, `src/app/context`.

---

## Sales Flow

**Customer → Sale → Payment → Invoice**

| Step | Component / Service | Description |
|------|----------------------|-------------|
| Customer | `ContactsPage`, `ContactList`, `contactService` | Select or create customer (contact). |
| Sale | `SalesPage`, `SaleForm`, `SalesContext`, `saleService` | Create sale (draft/final), add line items, branch. |
| Payment | `ViewPaymentsModal`, `UnifiedPaymentDialog`, `record_customer_payment` RPC | Record payment against sale; links to payments + journal. |
| Invoice | `invoiceDocumentService`, `ViewSaleDetailsDrawer`, print templates | Generate/print invoice (A4, thermal). |

**Routes:** Sales → Sale form → Save (draft/final) → Receive payment → Print invoice.

**DB:** `sales`, `sales_items`, `payments`, `journal_entries`, document numbering.

---

## Purchase Flow

**Supplier → Purchase → Payment → Ledger**

| Step | Component / Service | Description |
|------|----------------------|-------------|
| Supplier | `PurchasesPage`, `PurchaseForm`, `contactService` (supplier type) | Select supplier contact. |
| Purchase | `PurchaseForm`, `PurchaseContext`, `purchaseService` | Create purchase order, items, branch. |
| Payment | `ViewPurchaseDetailsDrawer`, payment flows, `purchaseService` | Pay supplier; posts to ledger. |
| Ledger | `accountingService`, journal entries, AP | Purchase and payment post to accounts. |

**Routes:** Purchases → New purchase → Items → Save → Pay supplier.

**DB:** `purchases`, `purchase_items`, `payments`, `journal_entries`, `contacts` (supplier).

---

## Manufacturing Flow

**BOM → Production Order → Steps → Finished Product**

| Step | Component / Service | Description |
|------|----------------------|-------------|
| BOM | `BillOfMaterialsPage`, `bomService` | Define bill of materials (inputs → output product). |
| Production order | `ProductionOrdersPage`, `ProductionWorkflow`, `productionOrderService` | Create order from BOM, status (draft → in progress → completed). |
| Steps | `ProductionWorkflow`, `productionStepService`, `production_steps` | Execute steps; track progress. |
| Finished product | Stock movement, `inventoryService` | On completion, receive output into inventory. |

**DB:** `bill_of_materials`, `production_orders`, `production_steps`, `stock_movements`, `products`.

**Migrations:** `manufacturing_bom_production_orders_steps.sql`.

---

## Studio Production Flow

**Order → Stages → Assign → Send/Receive → Invoice**

| Step | Component / Service | Description |
|------|----------------------|-------------|
| Orders | `StudioPipelinePage`, `StudioSalesListNew`, `studioProductionService` (V2/V3) | Studio orders linked to sales; V2/V3 tables. |
| Stages | `studio_production_stages`, `studio_production_stages_v2/v3` | Stage workflow (e.g. assigned → sent_to_worker → completed). |
| Assign / Send | RPCs `rpc_send_to_worker`, assignments, `StudioProductionV3OrderDetail` | Assign worker; send to worker; track sent_date. |
| Invoice | `StudioSaleDetailNew`, `studioCustomerInvoiceService`, `studioProductionV3InvoiceService` | Generate customer invoice from production. |

**DB:** `studio_production_orders_v2`, `studio_production_stages_v2`, `studio_production_orders_v3`, `sales` (source_id).

---

## Accounting Flow

**Ledgers, reports, payments**

| Area | Component / Service | Description |
|------|----------------------|-------------|
| Ledgers | `AccountingDashboard`, `CustomerLedgerPage`, `ledgerService`, `customerLedgerApi` | Customer/supplier/account ledgers. |
| Reports | `ReportsDashboardEnhanced`, `DayBookReport`, `accountingReportsService` | P&amp;L, trial balance, day book. |
| Payments | `UnifiedPaymentDialog`, `accountingService`, journal entries | Payment posting to AR/AP/cash. |

**DB:** `journal_entries`, `journal_entry_lines`, `accounts`, `payments`.

---

## Payments Flow

**Payment entry → Journal → Ledger**

| Step | Component / Service | Description |
|------|----------------------|-------------|
| Entry | `UnifiedPaymentDialog`, `ViewPaymentsModal`, `paymentUtils` | Record payment (account, amount, attachment). |
| Journal | `accountingService`, `saleAccountingService`, triggers | Post to journal_entries + lines. |
| Ledger | `ledgerService`, `get_contact_balances_summary_rpc` | Balances updated from journal. |

---

## Courier Flow

**Shipment → Courier → Tracking → Accounting**

| Step | Component / Service | Description |
|------|----------------------|-------------|
| Shipments | `ShipmentModal`, `ShipmentHistoryDrawer`, `shipmentService` | Link sale to shipment; weight, courier. |
| Courier | `courierService`, `couriers` table, `CourierManagementPanel` | Courier master; shipment cost. |
| Accounting | `shipmentAccountingService`, `CourierLedgerPanel`, `CourierReportsTab` | Courier ledger; cost posting. |

**DB:** `sale_shipments`, `couriers`, ledger/journal for courier costs.

---

## Wholesale / Bulk Invoice Flow

**Sale → Packing List → Courier Shipment → Bulk Invoice**

| Step | Component / Service | Description |
|------|----------------------|-------------|
| Sale | `SalesPage`, `saleService` | Base sale. |
| Packing list | `packingListService`, `packing_lists`, `packing_list_items` | Generate packing list from sale. |
| Courier shipment | `courierShipmentService`, `courier_shipments` | Link packing list to courier; tracking. |
| Bulk invoice | `bulkInvoiceService`, `bulk_invoices`, `bulk_invoice_items` | Aggregate multiple packing lists into one invoice. |

**DB:** `packing_lists`, `packing_list_items`, `courier_shipments`, `bulk_invoices`, `bulk_invoice_packing_lists`, `bulk_invoice_items`.

**Migrations:** `wholesale_packing_lists_and_items.sql`, `wholesale_packing_lists_courier_shipments.sql`, `wholesale_packing_lists_bulk_invoices.sql`.

---

## Summary Table

| Workflow | Main tables | Key services |
|----------|-------------|--------------|
| Sales | sales, sales_items, payments | saleService, invoiceDocumentService |
| Purchases | purchases, purchase_items, payments | purchaseService |
| Manufacturing | bill_of_materials, production_orders, production_steps | bomService, productionOrderService, productionStepService |
| Studio | studio_production_*_v2/v3, sales | studioProductionService, studioProductionV2Service, studioProductionV3Service |
| Accounting | journal_entries, accounts, payments | accountingService, ledgerService |
| Payments | payments, journal_entries | accountingService, UnifiedPaymentDialog |
| Courier | sale_shipments, couriers | shipmentService, courierService, shipmentAccountingService |
| Bulk Invoice | packing_lists, courier_shipments, bulk_invoices | packingListService, courierShipmentService, bulkInvoiceService |
