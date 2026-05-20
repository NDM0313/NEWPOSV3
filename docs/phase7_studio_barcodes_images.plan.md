# Phase 7 — Studio stock, product images, counter mode, barcodes

**Scope:** Safe-zone fixes under [`system-lockdown-safety.mdc`](../.cursor/rules/system-lockdown-safety.mdc). No GL trigger edits, no sale-status enum changes, no auth/Supabase URL changes.

Related: [`MASTER_PROMPT_STUDIO_SAFETY.md`](MASTER_PROMPT_STUDIO_SAFETY.md), [`PRODUCT_IMAGES_STORAGE_RLS_FIX.md`](PRODUCT_IMAGES_STORAGE_RLS_FIX.md).

---

## Task checklist

| ID | Item | Status |
|----|------|--------|
| `phase7-doc` | This plan file | Done |
| `phase7-studio-stock` | Single inward `PRODUCTION_IN` per studio finalize (dedupe legacy `PRODUCTION`) | Done |
| `phase7-product-images` | Storage RLS + signed URL display (web + mobile) | Done |
| `phase7-counter-login` | Post-login counter-mode prompt (Admin/Owner) → PIN overlay | Deferred |
| `phase7-barcode-print` | Real `react-barcode` + `@media print` on Products | Deferred |

---

## Task 2 — Studio sale double inward (CRITICAL)

### Problem

Finalizing a studio sale can create **two inward** ledger rows for the same STD order:

- Legacy `PRODUCTION` (+qty from `studio_productions.quantity`, e.g. +2)
- Canonical `PRODUCTION_IN` (+1 finished unit)

Then `SALE` out on finalize. Stock and COGS drift.

### Root cause

- Multiple callers invoke `ensureStudioProductionInForSale` (complete production, invoice sync, document stock sync, mobile finalize).
- [`createProductFromProductionOrder`](../../src/app/services/studioCustomerInvoiceService.ts) also inserted `PRODUCTION_IN` at product-create time.
- Idempotency only checked `movement_type = 'PRODUCTION_IN'`, not legacy `PRODUCTION`.

### Fix (implemented)

| File | Change |
|------|--------|
| [`studioStockLifecycleService.ts`](../src/app/services/studioStockLifecycleService.ts) | Dedupe on `PRODUCTION_IN`, `PRODUCTION`, `production`; single insert path |
| [`erp-mobile-app/src/api/studioStockLifecycle.ts`](../erp-mobile-app/src/api/studioStockLifecycle.ts) | Same dedupe (mobile parity) |
| [`studioCustomerInvoiceService.ts`](../src/app/services/studioCustomerInvoiceService.ts) | Removed direct stock insert; inward only via lifecycle helper after finalize |
| [`studioProductionInvoiceSyncService.ts`](../src/app/services/studioProductionInvoiceSyncService.ts) | Call `ensureStudioProductionInForSale` only when sale `final` or production `completed` |

### Test checklist

- [ ] New STD sale: all stages complete → finalize → product ledger: **one** inward (`PRODUCTION_IN`, +1) then **one** `SALE` out.
- [ ] Re-sync invoice pricing on draft sale → **no** new inward row.
- [ ] Mobile: save invoice line when stages complete → same single inward.
- [ ] Existing STD-0001-style duplicates: repair via manual adjustment (not auto-deleted in this phase).

---

## Task 3 — Product image uploads

### Problem

Thumbnails break on mobile (and sometimes web) when `product-images` bucket is private: DB stores `getPublicUrl()` but `<img>` needs signed URLs.

### Fix (implemented)

| File | Change |
|------|--------|
| [`erp-mobile-app/src/components/products/ProductImage.tsx`](../erp-mobile-app/src/components/products/ProductImage.tsx) | Signed URL display (parity with web) |
| [`ProductsModule.tsx`](../erp-mobile-app/src/components/products/ProductsModule.tsx) | Use `ProductImage` instead of raw `<img>` |
| [`productImageUpload.ts`](../src/app/utils/productImageUpload.ts) / mobile mirror | Normalize persisted URL to active Supabase project |
| [`migrations/20260521150000_product_images_storage_rls.sql`](../migrations/20260521150000_product_images_storage_rls.sql) | Idempotent storage RLS (forward migration) |

### Ops (production)

```bash
npm run apply-storage-rls
# or Supabase SQL Editor: supabase-extract/migrations/RUN_PRODUCT_IMAGES_STORAGE_RLS.sql
```

Ensure bucket **product-images** exists in Storage.

### Test checklist

- [ ] Upload image on web → thumbnail in Products list.
- [ ] Upload image on mobile → thumbnail in Products list.
- [ ] Existing `image_urls` with valid paths load via signed URL.

---

## Task 4 — Login counter mode prompt (deferred)

After successful login for **Admin/Owner**, prompt: *Enable Counter Mode on this device?* If yes, show PIN enrollment overlay (reuse [`SettingsModule`](../erp-mobile-app/src/components/settings/SettingsModule.tsx) counter PIN flow) without navigating to Settings.

**Files:** [`LoginScreen.tsx`](../erp-mobile-app/src/components/LoginScreen.tsx), [`sharedCounterMode.ts`](../erp-mobile-app/src/lib/sharedCounterMode.ts).

---

## Task 5 — Barcode printing (deferred)

Replace fake barcode preview in [`PrintBarcodeModal.tsx`](../src/app/components/products/PrintBarcodeModal.tsx) with `react-barcode`, print CSS (`@media print`), wire from Products → Print Barcodes.

---

## Lockdown compliance

| Area | This phase |
|------|------------|
| GL / `record_sale_with_accounting` | Not touched |
| Sale-final stock triggers | Not touched |
| `stock_movements` | Client dedupe + remove duplicate insert; no destructive SQL |
| RLS | Additive storage policies only |
| Auth / mobile Supabase URL | Not touched |
