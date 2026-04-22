# Completed work — Mobile Fixes Bundle 2 & related (April 2026)

This document records what was shipped in the same push as `docs/REMAINING_TASKS.md` updates, so the office and GitHub history stay aligned.

## Mobile (`erp-mobile-app/`)

1. **Product images in sales** — `PRODUCTS_SELECT` includes `image_urls`; product tiles show first image where available.
2. **Packing UI gated** — `SettingsContext` + `getEnablePacking`; packing blocks in cart / related flows only when `enable_packing` is on for the company.
3. **Sale summary** — Cart quantity default fixed for zero-qty lines; `SaleSummary` syncs discount/notes from parent; **Shipping** card removed; create path sends `shipping: 0`.
4. **Purchases** — Mobile flow can choose **Order** vs **Received** before save; status wired to `ordered` / `received` / `final` as per plan.
5. **Database** — `migrations/20260424_fix_purchase_received_stock_trigger.sql`: stock trigger runs for `received` and `final`; includes backfill for purchases missing `stock_movements` (apply on Supabase/VPS as per your runbook).
6. **PDF / print preview (mobile)** — `PdfPreviewModal`, `ReportBrandHeader`, preview components (`LedgerPreviewPdf`, `TimelinePreviewPdf`, `AgingPreviewPdf`, `ReceiptPreviewPdf`), `usePdfPreview`; accounts reports and payment receipt flows open preview before share/download/print.
7. **Inventory** — `InventoryModule` redesigned (summary tiles, filters, richer cards with image); **`ProductHistoryModal`** + `getProductStockMovements` in `api/inventory.ts` for per-product movement history and PDF preview.

## Web (`src/`)

1. **`PdfPreviewModal`** — Preview modal with clone-from-ref support for existing print DOM.
2. **`DocumentPreviewButton`** — Reusable preview entry for document views.
3. **`DocumentShareActions`** — **Preview** action opens the modal (WYSIWYG before download/share).
4. **Global print styling** — `src/styles/index.css`: `.pdf-document` sheet + B&W `@media print` rules.
5. **Unified document views** — Preview wired: `UnifiedLedgerView`, `UnifiedReceiptView`, `UnifiedQuotationView`, `UnifiedProformaInvoiceView`, `UnifiedPackingListView`, `UnifiedCourierSlipView`, `UnifiedPurchaseInvoiceView` (under `src/app/documents/`).
6. **Reports / ledger UI** — `DayBookReport.tsx`, `AccountLedgerPage.tsx` include preview entry where applicable.

## Migrations included in repo (apply via your normal process)

- `migrations/20260422_party_subledger_rpcs_and_payment_routing.sql`
- `migrations/20260423_document_posting_rpcs.sql`
- `migrations/20260424_fix_purchase_received_stock_trigger.sql`

**Note:** Local-only scratch files matching `migrations/_tmp*.sql` are **not** committed; delete or ignore them on your machine if no longer needed.

## Verification run before push

- `npm --prefix erp-mobile-app run typecheck` — pass.
- `npx vite build` (web, from repo root) — pass.

---

**See also:** `docs/REMAINING_TASKS.md` for what is still optional / later for the office.
