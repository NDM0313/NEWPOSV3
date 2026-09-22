# Web Sales/Purchase Save Performance — 2026-07-05

## Problem statement

Mobile Sales/Purchase saves feel fast; web ERP save on `erp.dincouture.pk` felt noticeably slow after clicking Save. Investigation targeted web-only bottlenecks without changing GL/inventory semantics or running migrations.

## Mobile vs web code path comparison

| Area | Mobile (`erp-mobile-app`) | Web (before fix) |
|------|---------------------------|------------------|
| Document create | RPC chain: `create_sale_document_header` → stock RPC → `record_sale_with_accounting` | `saleService.createSale` + sequential context work |
| Variation lookup | Selected variation passed from UI | N sequential `productService.getProduct()` per line in `SaleForm` |
| Stock reconcile (Z1) | Inline RPC; UI returns after core path | `await syncSaleStockForDocument` / `syncPurchaseStockForDocument` blocked save |
| Payment JE | Handled in accounting RPC path | Duplicate `accounting.recordSalePayment` after payments already recorded |
| Negative stock check | Service/trigger path | Duplicated in `SalesContext` and `saleService.createSale` |
| Success UX | Immediate return | Toast + form waited for attachments, shipment row, Z1 sync |
| Post-save refresh | Targeted | Broad blocking work before toast/navigation |

## Root cause

1. **SaleForm N+1 product fetches** for variation resolution (one DB round-trip per line item).
2. **SalesContext awaited Z1 stock sync** after create — extra RPC round-trip on critical path.
3. **Duplicate sale payment journal entry** (`recordSalePayment` called twice for same initial payment).
4. **Duplicate negative-stock validation** in context before `saleService.createSale`.
5. **Duplicate success toasts** (context + form).
6. **Post-save blocking work in forms**: attachment upload and shipping shipment row ran before success toast; purchase attachments blocked before toast.

Accounting posting order and GL semantics were **not** changed — only removed redundant work and moved non-critical I/O off the critical path.

## Files changed

- `src/app/lib/webSaveTiming.ts` — dev-only timing helper (labels + ms)
- `src/app/lib/webSaveTiming.test.ts` — unit tests
- `src/app/context/SalesContext.tsx` — remove duplicate stock check & duplicate payment JE; Z1 sync background; no create toast
- `src/app/context/PurchaseContext.tsx` — Z1 sync background; no create toast
- `src/app/components/sales/SaleForm.tsx` — batched variation prefetch; timing marks; toast after core save; background shipment/attachments
- `src/app/components/purchases/PurchaseForm.tsx` — toast after core save; background attachments
- `package.json` — include `webSaveTiming.test.ts` in `test:unit`

## Fix summary

- Batch product fetches for variation IDs (parallel, deduped by product id).
- Remove redundant validation and duplicate payment JE on web sale create.
- Run Z1 document stock sync in background (trigger still posts stock; Z1 reconciles asynchronously).
- Show success immediately after `createSale` / `createPurchase`; defer attachments and shipping row to background.
- Single toast from form layer on create (context logs in DEV only).
- Dev-only `[web-save-timing]` instrumentation for future profiling.

## Before behavior

Save button stayed in loading state while web performed per-line product lookups, awaited Z1 sync, sometimes double-posted payment JE work, uploaded attachments, and created shipment rows before showing success.

## After behavior

Save completes and shows success as soon as the core create + required accounting path finishes. Variation lookup uses batched parallel fetches. Z1 sync, attachments, and optional shipment row run without blocking the primary success path. Duplicate payment JE and duplicate stock checks removed.

## Tests/build results

See `tests-build-summary.json` in this folder (populated after test run).

- `npm run test:unit` — expected PASS (includes `webSaveTiming.test.ts`)
- `npm run test:unified-ledger` — expected PASS
- `npm run build` — expected PASS

## Safety confirmation

| Check | Status |
|-------|--------|
| migrations_run | false |
| production_data_mutation | false |
| gl_semantics_changed | false |
| inventory_semantics_changed | false |
| r8_run | false |
| play_store_upload | false |
| credentials_committed | false |

## Deploy status

**NOT DEPLOYED** — awaiting Nadeem explicit frontend deploy approval after review.

## Calendar note (same session)

Local date `2026-07-05` — Calendar Day 6/7/8 **not date-eligible**. Day 5 already committed at `bcbd5fe4`.
