# ERP Development Roadmap — Production Ready

**Purpose:** After Create Business wizard + business type templates, development must follow a **fixed priority order**. No random features. Focus: **workflow completeness**, **document engine**, **operational features**.

---

## Current ERP Status (Implemented)

| Area | Status |
|------|--------|
| Create Business wizard | Done |
| Business type templates (Retail, Wholesale, Manufacturing, Rental, Mixed) | Done |
| Module auto-selection from business type | Done |
| Printing settings engine (types, DB, UI) | Done |
| Accounting reports | Done |
| Courier accounting | Done |
| Payment system | Done |
| Backup automation | Done |

**Core ERP skeleton is complete.** Roadmap steps 1–7 are complete; Step 8 (Barcode) is postponed to mobile app.

**Migrations (auto-apply):** Run `npm run migrate` to apply pending SQL (uses `DATABASE_URL` / `DATABASE_ADMIN_URL` from `.env.local`). Script runs `supabase-extract/migrations/` then `migrations/` in order.

- **Ownership:** If you see "must be owner of function/table", the DB user is not the object owner. For a full clean run, set `DATABASE_ADMIN_URL` to a postgres/superuser connection (e.g. direct Postgres URL from Supabase). Migrations 59, accounting_ensure_*, courier_*, and auto_assign_default_branch have been made resilient (they catch permission errors and continue so the migration file still passes).
- **Allow fail:** Use `npm run migrate -- --allow-fail` so a single failing migration does not block the app; then fix or run as postgres and run `npm run migrate` again.

---

## Golden Rule

- **Do not** add features outside this roadmap order.
- **Focus:** system consistency → document system → workflow clarity.
- When these three are strong, the system becomes enterprise-level ERP.

---

## Recommended Development Order

### Step 1 — Unified Document Engine ✅ (Complete)

**Goal:** All printable documents use the **same rendering engine** and read from **printing_settings**.

**Documents in scope:** Sales Invoice, Purchase Invoice, Ledger Statement, Payment Receipt, Packing List.

**Final structure:**

```
src/app/documents/
  resolveOptions.ts
  useUnifiedDocumentSettings.ts
  UnifiedSalesInvoiceView.tsx
  UnifiedPurchaseInvoiceView.tsx
  UnifiedLedgerView.tsx
  UnifiedReceiptView.tsx
  UnifiedPackingListView.tsx
  adapters/
    purchaseToInvoiceDocument.ts
  templates/
    PurchaseInvoiceTemplate.tsx
    LedgerTemplate.tsx
    ReceiptTemplate.tsx
    PackingListTemplate.tsx
```

**Flow:** User clicks Print → Unified*View → load `printing_settings` → resolve options → select template → render (ClassicPrintBase) → Print / PDF.

**Done:**

- **Sales Invoice:** `UnifiedSalesInvoiceView`; wired in `ViewSaleDetailsDrawer` and `SaleForm` (Save & Print). Uses RPC document + printing_settings.
- **Purchase Invoice:** `UnifiedPurchaseInvoiceView` + `purchaseToInvoiceDocument` adapter + `PurchaseInvoiceTemplate` (PO No, Bill From). Wired in `ViewPurchaseDetailsDrawer`; replaces `PurchaseOrderPrintLayout` for print.
- **Ledger Statement:** `UnifiedLedgerView` + `LedgerTemplate` (Date, Doc No, Description, Debit, Credit, Balance). Options: show company address, notes, signature from settings. Caller passes `document` + `companyId`.
- **Payment Receipt:** `UnifiedReceiptView` + `ReceiptTemplate` (Receipt No, Date, Customer, Amount, Method, Reference, Notes, Signature). Caller passes `document` + `companyId`.
- **Packing List:** `UnifiedPackingListView` + `PackingListTemplate` (Product, SKU, Pieces, Cartons, Weight). Options: show SKU, company address, notes, signature. Caller passes `document` + `companyId`.

**Rule:** No new document should render from a direct template; all go through the unified engine and `printing_settings`.

---

### Step 2 — Document Preview Engine ✅ (Complete)

**Goal:** Settings → Printing → **Live Preview** with toggles affecting preview in real time.

**Preview documents:**

- Sales Invoice  
- Purchase Invoice  
- Ledger Statement  
- Payment Receipt  
- Packing List  

**Behaviour:**

- Toggles (e.g. Show SKU = OFF) → preview column hides.  
- Page setup (size, orientation, margins) → preview updates.  
- Same `printing_settings` (mergeWithDefaults) as the unified document engine.

**Done:**

- `PrintingPreviewPanel.tsx` uses the same `fields`, `layout`, `pageSetup`, `pdf` from `printing_settings`.  
- **Sales / Purchase Invoice:** Table with Product, optional SKU/Discount/Tax/Studio columns (from toggles), totals, notes, signature.  
- **Ledger Statement:** Date, Doc No, Description, Debit, Credit, Balance table + closing balance.  
- **Payment Receipt:** Receipt No, Date, Customer, Amount, Method, Reference; optional Notes and Signature.  
- **Packing List:** Product, optional SKU, Pieces, Cartons, Weight + totals.  
- Footer label: "Live preview (matches print)".

**Deliverable:** Live preview that reflects all toggles; no divergence between preview and print/PDF.

---

### Step 3 — Business Type Workflows ✅ (Complete)

**Goal:** Business type drives **workflow templates**, not only module selection.

**Examples:**

| Type | Workflow |
|------|----------|
| Retail | Sale → Payment → Receipt |
| Wholesale | Sale → Packing List → Courier → Payment |
| Manufacturing | Purchase Raw Material → Production → Finished Goods → Sale |
| Rental | Rental Booking → Dispatch → Return → Payment |
| Mixed | Sale, Purchase, Rental, Studio, Payment (no fixed order) |

**Deliverable:** Defined workflows per business type (config or code). Done: workflows in src/app/workflows; company.businessType in SettingsContext; WorkflowNextStepBanner on Sale detail. UI can reflect “next step” in the workflow where applicable.

---

### Step 4 — Manufacturing ✅ (Complete)

**Scope:** Full manufacturing support: BOM, production orders, production steps (Cutting, Dyeing, Stitching, Handwork, Finishing).

**Done:**

- **DB:** Migration `migrations/manufacturing_bom_production_orders_steps.sql`: tables `bill_of_materials` (product_id, material_id, quantity_required, unit_id), `production_orders` (company_id, branch_id, product_id, quantity, status, start_date, end_date, order_number), `production_steps` (production_order_id, step_name, sort_order, worker_id, cost, status, completed_at). RLS and updated_at triggers.
- **Services:** `bomService`, `productionOrderService`, `productionStepService` (create steps from default list: Cutting, Dyeing, Stitching, Handwork, Finishing).
- **UI:** Manufacturing module (visible when Studio module is enabled). Pages: **Bill of Materials** (list/add/edit BOM lines), **Production Orders** (list, create order, open workflow), **Production Workflow** (steps per order, assign worker, mark complete, cost).
- **Flow:** BOM defines materials per product → Production order created for product + qty → Steps created automatically → Assign workers and complete steps (aligned with Studio: Dyeing, Stitching, Handwork).
- **Applying the migration:** Run `npm run migrate`. If migrations stop earlier (e.g. ownership on another migration), run `migrations/manufacturing_bom_production_orders_steps.sql` manually in Supabase SQL Editor (or with `DATABASE_ADMIN_URL`), then record it in `schema_migrations` if needed.

---

### Step 5 — Wholesale Operations ✅ (Complete)

**Goal:** Sale → Packing List → Courier Shipment → (Bulk) Invoice → Payment.

**Done:**

- **Packing List workflow:** DB tables `packing_lists`, `packing_list_items`. Sales → sale detail → "Packing List" → Generate Packing List → Print via `UnifiedPackingListView`. Services: `packingListService` (create from sale, list by sale/company).
- **Courier Shipment:** DB table `courier_shipments` (packing_list_id, courier_id, tracking_number, shipment_cost, status). From Packing List → "Shipment" → Create Shipment (courier, tracking, cost) → Print **Courier Slip** via `UnifiedCourierSlipView` + `CourierSlipTemplate` (unified engine).
- **Bulk Invoice:** DB tables `bulk_invoices`, `bulk_invoice_items`, `bulk_invoice_packing_lists`. Sales page → "Bulk Invoice" → Select packing lists → Customer name → Generate → Print via `UnifiedSalesInvoiceView` (document from `bulkInvoiceService.getInvoiceDocument`).

**Migrations:** `migrations/wholesale_packing_lists_and_items.sql`, `wholesale_courier_shipments.sql`, `wholesale_bulk_invoices.sql`. Apply in that order.

**Folder:** `src/app/wholesale/` — `PackingListWorkflow.tsx`, `CourierShipmentWorkflow.tsx`, `BulkInvoiceWorkflow.tsx`. Documents: `CourierSlipTemplate.tsx`, `UnifiedCourierSlipView.tsx` in `src/app/documents/`.

---

### Step 6 — Sales Improvements ✅ (Complete)

**Goal:** Quotation → Proforma → Convert to Sale.

**Done:**

- **Quotations:** DB tables `quotations`, `quotation_items` (migration `migrations/sales_quotations.sql`). Service: `quotationService` (create, list, getById, update, updateItems, convertToSale, quotationToQuotationDocument, quotationToProformaDocument).
- **Documents:** `QuotationTemplate.tsx`, `UnifiedQuotationView` (print quotation); proforma uses `UnifiedProformaInvoiceView` + `A4InvoiceTemplate` with title "PROFORMA INVOICE" (same engine, printing_settings).
- **UI:** Sales page → "Quotation" opens `QuotationWorkflow`: list quotations, New Quotation (customer + items table), per row: Print (quotation), Proforma (proforma invoice), Convert to Sale. On convert, sale is created and drawer opens.

**Flow:** Create Quotation → Print / Generate Proforma → Convert to Sale → Invoice/Payment.

---

### Step 7 — Notifications ✅ (Complete)

**Goal:** Useful alerts in header: low stock, courier balance, payment due.

**Done:**

- **TopHeader** notification dropdown: **Low stock** (from `productService.getLowStockProducts`), **Courier balance due** (from `shipmentAccountingService.getCourierBalances`), **Payment due** (unpaid sales, purchases, pending expenses). Count badge and list built from real data; limits applied so list stays small.

---

### Step 8 — Barcode (Mobile)

**Status:** Postponed; to be implemented in **mobile app**.

**Flow:** Scan product → Auto-add to sale.

---

### Final Web ERP Phase — Production Ready ✅

**Goal:** PDF export, document share, audit logs, performance, PWA. Web ERP is production-ready; further work shifts to mobile (barcode, POS).

**Done:**

1. **PDF Export** — `pdfExportService`: convert document HTML (unified engine) to PDF via html2canvas + jspdf. Supports Sales Invoice, Purchase Invoice, Quotation, Proforma, Ledger, Receipt, Packing List. `ClassicPrintBase` + A4/Thermal templates accept optional `contentRef` for PDF capture.
2. **Document Share** — `documentShareService`: Download PDF, Share via WhatsApp (wa.me + pre-filled text), Share via Email (mailto). `DocumentShareActions` component used in `UnifiedSalesInvoiceView` (Print + Share dropdown).
3. **Audit Log** — Table `audit_logs` (company_id, user_id, table_name, record_id, action, old_data, new_data). `auditLogService`: `logAudit`, `logSaleAction`, `logPaymentAction`, `logPurchaseAction`, `logProductionOrderAction`. Sale create is logged; other entities can be wired the same way.
4. **Performance** — Migration `migrations/final_web_erp_performance_indexes.sql`: indexes on `sales_items(sale_id)`, `sales(company_id, invoice_date DESC)`, `production_orders(company_id, status)`.
5. **PWA** — `vite-plugin-pwa`: installable app, auto-update, workbox caching for assets and images. Manifest name/short_name "ERP", standalone display.

**Order implemented:** Phase A (PDF) → Phase B (Share) → Phase C (Audit) → Phase D (Performance) → PWA.

**Next:** Mobile app (`erp-mobile-app`) for barcode scanning and mobile POS.

---

## Next Steps (Stability → Mobile)

**Focus:** Stability, speed, mobile — not new features. Web ERP is production-ready; avoid scope creep.

### 1. Database & migration safety (auto-apply)

- **Auto-apply migrations:** Run `npm run migrate` from repo root to apply all pending SQL (uses `DATABASE_URL` / `DATABASE_POOLER_URL` / `DATABASE_ADMIN_URL` from `.env.local`). Use `npm run migrate -- --allow-fail` so a single failing migration does not block the app.
- **Production indexes:** `final_web_erp_performance_indexes.sql` creates the `production_orders` index only when the table exists (`IF EXISTS` in `information_schema.tables`). If manufacturing is disabled or tables were removed, the migration does not fail.
- **Rule for new migrations:** For any index or object on optional tables (`production_orders`, `production_steps`, `bill_of_materials`), use:
  - `IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '...') THEN ... END IF;` inside a `DO $$ ... END $$` block, or
  - `BEGIN ... EXCEPTION WHEN ... THEN ... END` so deployment never fails when those tables are missing.
- No need to “remove” indexes on dropped tables: Postgres drops indexes when the table is dropped.

### 2. Mobile app (`erp-mobile-app`) — priority order

| Priority | Focus | Status |
|----------|--------|--------|
| Step 1 | Barcode scanning | ✅ Done (`features/barcode/`, POS Scan button) |
| Step 2 | Thermal printer (Settings → Printer) | ⏳ Settings UI done; hardware plugin optional |
| Step 3 | Mobile POS (grid, cart, payment, receipt) | ✅ Done (`POSModule`) |
| Step 4 | Offline sales sync | ✅ Done (IndexedDB + `syncEngine`) |

**Structure:** See **`docs/MOBILE_APP_ARCHITECTURE.md`** for folder layout, flows, and auto-apply notes.

---

## Summary Order

| Step | Focus |
|------|--------|
| 1 | Unified Document Engine ✅ |
| 2 | Document Preview (Settings → Printing) ✅ |
| 3 | Business Type Workflows ✅ |
| 4 | Manufacturing (BOM, production orders) ✅ |
| 5 | Wholesale (Packing List, Courier, Bulk Invoice) ✅ |
| 6 | Sales (Quotation, Proforma) ✅ |
| 7 | Notifications ✅ |
| 8 | Barcode (mobile) — Postponed |
| Final | PDF Export, Document Share, Audit Logs, Performance, PWA ✅ — **Web ERP Production Ready** |

---

## Complete ERP Roadmap (Production Ready) — To Expand

When ready, this section can be filled with a full breakdown of:

- **Modules** — per-module scope and boundaries  
- **Workflows** — per business type and document flows  
- **Documents** — list and which engine/template they use  
- **Automation** — backups, numbering, alerts  
- **Security** — RLS, roles, audit  

Until then, **development follows the step order above**; no random features outside this list.

---

## Auto-fix / consistency (done)

- **Sales print:** All sales print paths use the unified document engine (`UnifiedSalesInvoiceView`): ViewSaleDetailsDrawer and SaleForm (Save & Print). `InvoicePrintLayout` is no longer used for sales.
- **Preview:** PrintingPreviewPanel uses same `printing_settings` (mergeWithDefaults) and field toggles as the engine.
- **Workflows:** WorkflowNextStepBanner uses app navigation (`setCurrentView`), not URL routes.
- **Company:** `company.businessType` loaded from `companies.business_type` in SettingsContext; migration 59 adds the column and extends `create_business_transaction`.
