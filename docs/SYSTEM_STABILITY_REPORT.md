# System Stability Report

**Date:** Generated after 10-step stabilization.  
**Project:** NEW POSV3 (Web ERP + erp-mobile-app).

---

## 1. ERP health

| Check | Status | Notes |
|-------|--------|--------|
| **Build** | OK | `npm run build` succeeds. |
| **Dev server** | OK | `npm run dev` runs migrations (with `--allow-fail`) then starts Vite; http://localhost:5173. |
| **PWA** | OK | `vite-plugin-pwa` installed; workbox `maximumFileSizeToCacheInBytes` set to 5 MiB for large main chunk. |
| **Code** | OK | `bulkInvoiceService.ts` const reassignment fixed (fallbackItems for sale_items query). |
| **Dependencies** | OK | `vite-plugin-pwa` in devDependencies; installed and used in `vite.config.ts`. |

---

## 2. Database status

| Check | Status | Notes |
|-------|--------|--------|
| **Migrations** | OK | `npm run migrate` (and `npm run migrate -- --allow-fail`) run; migrations applied in order (supabase-extract then migrations/). |
| **Key tables** | OK | `production_orders`, `production_steps`, `bill_of_materials` (manufacturing_bom_production_orders_steps.sql); `packing_lists` (wholesale_packing_lists_and_items.sql); `courier_shipments` (wholesale_packing_lists_courier_shipments.sql); `bulk_invoices` (wholesale_packing_lists_bulk_invoices.sql). All use CREATE TABLE IF NOT EXISTS or conditional logic. |
| **Performance indexes** | OK | `final_web_erp_performance_indexes.sql`: idx_sales_items_sale_id, idx_sales_company_date, idx_production_orders_company_status (inside DO block when table exists). |
| **Safe patterns** | OK | Order-dependent migrations fixed with IF EXISTS / DO $$ blocks or filename reordering (see Step 9). |

---

## 3. Mobile readiness

| Area | Status | Notes |
|------|--------|--------|
| **Structure** | OK | erp-mobile-app: Capacitor, React, Vite; modules for sales, purchase, contacts, products, inventory, accounting, studio, rental, reports, settings. |
| **Barcode** | OK | `src/features/barcode`: camera (ML Kit native + BarcodeCameraModal web), useBarcodeScanner, barcodeService. Implementation plan in erp-mobile-app/features/barcode/BARCODE_IMPLEMENTATION_PLAN.md. |
| **API** | OK | Uses same Supabase backend; env synced via sync-mobile-env.js. |
| **Offline** | Partial | SyncStatusBar, useNetworkStatus; no queue/sync implementation yet. |
| **Docs** | OK | MOBILE_AUDIT_REPORT.md, MOBILE_APP_ARCHITECTURE.md, barcode plan. |

---

## 4. Remaining tasks

| Priority | Task | Owner / note |
|----------|------|--------------|
| High | Reduce main chunk size (e.g. code-split, dynamic imports) | Build succeeds but chunk > 500 kB warning; PWA precache limit raised to 5 MiB. |
| Medium | Implement barcode → product lookup in mobile Add Products | See BARCODE_IMPLEMENTATION_PLAN.md. |
| Medium | External scanner (keyboard wedge) support in mobile | Plan in barcode doc. |
| Medium | Offline queue + sync for mobile | Architecture doc; not yet implemented. |
| Low | Customer ledger view on mobile | Marked in MOBILE_AUDIT_REPORT.md. |
| Low | Packing list / bulk invoice UI on mobile | Same. |

---

## 5. Deliverables completed

| Step | Deliverable | Location |
|------|-------------|----------|
| 1 | Build fix | vite-plugin-pwa installed; vite.config.ts verified; PWA workbox limit; bulkInvoiceService fix. |
| 2 | Dev server | npm run dev; port 5173. |
| 3 | Migration audit | Tables present via existing migrations; ensure_workflow_tables_audit.sql (documentation no-op). |
| 4 | Performance indexes | final_web_erp_performance_indexes.sql (sales_items, sales, production_orders). |
| 5 | ERP workflow map | docs/ERP_WORKFLOW_MAP.md |
| 6 | Mobile audit | docs/MOBILE_AUDIT_REPORT.md |
| 7 | Mobile architecture | docs/MOBILE_APP_ARCHITECTURE.md |
| 8 | Barcode plan | erp-mobile-app/features/barcode/BARCODE_IMPLEMENTATION_PLAN.md |
| 9 | Migration stability | Order/conditional fixes already applied (see conversation summary). |
| 10 | Final verification | npm run build: success. |

---

## 6. Commands reference

```bash
# Build
npm run build

# Dev (migrations + Vite)
npm run dev

# Migrations only
npm run migrate
npm run migrate -- --allow-fail

# Mobile
npm run mobile:dev
```

---

**Summary:** Build and dev server are stable; database migrations and indexes are in place; workflow map, mobile audit, architecture, and barcode plan are documented; remaining work is chunk size, barcode product lookup, external scanner, and offline sync.
