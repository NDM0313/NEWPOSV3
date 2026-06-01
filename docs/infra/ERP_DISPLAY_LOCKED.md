# ERP display lock — product photos + stock (LOCKED)

**Status:** Locked for production (`erp.dincouture.pk`, Capacitor APK, PWA `/m/`).  
**Purpose:** Prevent regressions where product thumbnails fail or inventory qty disagrees across screens.

Do **not** change the behaviors below in drive-by refactors without explicit product-owner approval and an update to this file.

---

## Picture / file upload status (2026-06)

| Surface | Client | Fix | Build / note |
|---------|--------|-----|----------------|
| Product photos | APK | Native binary upload + post-upload verify | build **32+** (Section A) |
| Sale / purchase / payment / journal / expense attachments | APK | [`storageAttachmentPipeline.ts`](../../erp-mobile-app/src/utils/storageAttachmentPipeline.ts) + blob image preview | build **33+** (Section D) |
| Company logo | Web ERP Settings | `company-logos` bucket + RLS | [`COMPANY_LOGOS_STORAGE.md`](../COMPANY_LOGOS_STORAGE.md), migration `20260601150000_company_logos_storage_bucket.sql` |
| Corrupt ~2-byte files on server | Any | Re-upload file | Not auto-repaired |

---

## Related docs

| Doc | Role |
|-----|------|
| [`AUTH_PRODUCTION_LOCKED.md`](AUTH_PRODUCTION_LOCKED.md) | Auth, Kong, ERP nginx `/auth` `/rest` |
| [`MOBILE_APK_LOCKED_PATTERN.md`](MOBILE_APK_LOCKED_PATTERN.md) | Native Supabase URL (Capacitor) |
| [`PRODUCT_IMAGES_STORAGE_RLS_FIX.md`](../PRODUCT_IMAGES_STORAGE_RLS_FIX.md) | Storage RLS + bucket setup |
| [`COMPANY_LOGOS_STORAGE.md`](../COMPANY_LOGOS_STORAGE.md) | Web company logo bucket + deploy/SQL steps |
| [`INVENTORY_MANAGEMENT_DESIGN.md`](../INVENTORY_MANAGEMENT_DESIGN.md) | Historical design; **UI display stock** follows Section B here |

---

## Section A — Product photos (locked)

### Root causes (do not reintroduce)

| Issue | Symptom | Fix location |
|-------|---------|--------------|
| Double bucket in sign path | `POST .../sign/product-images/product-images/...` → 404, empty thumbs | [`src/app/utils/productImageUpload.ts`](../../src/app/utils/productImageUpload.ts) — `extractProductImageStoragePath` strips leading `product-images/` (including repeated prefixes) |
| PWA stale JS bundle | Console shows old `index-*.js` hash; sign path bug after server deploy | [`vite.config.ts`](../../vite.config.ts) Workbox `skipWaiting` + `clientsClaim`; [`src/main.tsx`](../../src/main.tsx) `registerSW({ immediate: true })` |
| Nginx static regex catches uploads | `POST .../storage/v1/object/.../file.jpg` → HTML 404, JSON parse error on upload | [`deploy/nginx.conf`](../../deploy/nginx.conf) — static cache regex must exclude `/storage/`: `(?!storage/)` |

### Non-negotiable rules

1. **Sign path** — `createSignedUrl` must receive object path **without** bucket prefix: `{companyId}/{productId}/{uuid}.jpg`, not `product-images/...`.
2. **Production web API** — Same-origin `https://erp.dincouture.pk` for auth/rest/storage ([`src/lib/supabase.ts`](../../src/lib/supabase.ts)); do not point production SPA at raw `supabase.dincouture.pk` for storage `<img>` without CORS review.
3. **Nginx** — Keep `location /storage/` proxy to Kong; never add a file-extension `location` that matches `/storage/.../*.jpg` without excluding `/storage/`.
4. **Mobile APK** — Product images use [`erp-mobile-app/src/utils/storageDisplayUrl.ts`](../../erp-mobile-app/src/utils/storageDisplayUrl.ts) (blob download + native sign host). Follow [`MOBILE_APK_LOCKED_PATTERN.md`](MOBILE_APK_LOCKED_PATTERN.md) for API base URL.
5. **DB `image_urls`** — May store `product-images/{path}` or path-only; clients must normalize via `extractProductImageStoragePath` / `resolveStorageRef`. Optional DB normalize is **not** required for display once clients are correct.

### Verification checklist (operators)

After each ERP deploy:

1. Hard refresh `https://erp.dincouture.pk` (Ctrl+Shift+R) or clear site data once; unregister old service worker if thumbs still wrong.
2. **Sign:** DevTools → Network → Products → `POST .../storage/v1/object/sign/product-images/{companyId}/...` — exactly **one** `product-images/` in URL; response **JSON** (200), not HTML.
3. **Upload:** Edit product → upload image → `POST .../storage/v1/object/product-images/{companyId}/.../....jpg` — response **JSON** (200/403), not nginx HTML 404.
4. **APK:** Install only `erp-mobile-app/releases/erp-mobile-1.0.5-build33.apk` (or newer documented build); build locally via [`erp-mobile-app/releases/BUILD_AND_GRAPHIFY_COMMANDS.md`](../../erp-mobile-app/releases/BUILD_AND_GRAPHIFY_COMMANDS.md).
5. **APK camera:** Add/Edit product → **Take photo** → preview appears before save; after save, list thumb loads. Native capture must use `Filesystem.readFile` on `photo.path` ([`erp-mobile-app/src/lib/mediaPick.ts`](../../erp-mobile-app/src/lib/mediaPick.ts)) — not `fetch(webPath)` alone.
6. **APK primary thumb:** List/preview use `image_urls[0]`. **Update image** replaces the array with the new upload; edit-form uploads **prepend** new paths. Do not append new uploads after old URLs only (UI would still show index 0).
7. **APK product-image upload (build 32+ verified):** [`uploadProductImages`](../../erp-mobile-app/src/utils/productImageUpload.ts) must use [`uploadStorageObjectWithNativeFallback`](../../erp-mobile-app/src/utils/storageObjectUpload.ts) → [`nativeStorageObjectUpload`](../../erp-mobile-app/src/utils/nativeStorageUpload.ts). **Do not refactor** product path logic into attachment helpers without explicit approval.
8. **APK debug log (broken thumbs):** Settings → **App version** tap **7×** → Developer Tools → **Debug log** → reproduce Products thumb → **Share** log. Uses [`erp-mobile-app/src/lib/mobileDebugLog.ts`](../../erp-mobile-app/src/lib/mobileDebugLog.ts) + [`MobileDebugLogSection.tsx`](../../erp-mobile-app/src/components/settings/MobileDebugLogSection.tsx). JWT/tokens redacted in exported text.

### Locked files (product photos)

- `src/app/utils/productImageUpload.ts`
- `src/app/components/products/ProductImage.tsx`
- `deploy/nginx.conf` (`location /storage/` + static asset regex)
- `vite.config.ts` (PWA workbox)
- `src/main.tsx` (SW registration)
- `erp-mobile-app/src/utils/storageDisplayUrl.ts`
- `erp-mobile-app/src/utils/productImageUpload.ts`
- `erp-mobile-app/src/lib/mediaPick.ts` (native camera → File)
- `erp-mobile-app/src/utils/storageObjectUpload.ts` (native storage upload fallback)
- `erp-mobile-app/src/lib/mobileDebugLog.ts` (Developer Mode in-app log capture)
- `erp-mobile-app/src/utils/nativeStorageDownload.ts` (native storage download for blobs)
- `erp-mobile-app/src/utils/nativeStorageUpload.ts` (native storage upload binary)
- `erp-mobile-app/src/utils/imageBlobValidation.ts` (reject 2-byte / JSON stub blobs)

---

## Section D — Mobile attachments (APK, build 33+)

### Scope (all use one upload + display contract)

| Module | Upload API | Bucket | Display |
|--------|------------|--------|---------|
| Sales | `uploadSaleAttachments` | `sale-attachments` | `AttachmentPreviewModal` → `getStorageDisplayUrl` |
| Purchases | `uploadPurchaseAttachments` | `purchase-attachments` | same |
| Payments (receive/pay, supplier/client) | `uploadPaymentAttachments` | `payment-attachments` | same |
| Journal / account transfer / COA entries | `uploadJournalEntryAttachments` | `payment-attachments` (`journal-entries/...`) | same |
| Expenses | `uploadExpenseReceipt` | `expense-receipts` | same |

**Transactions list** (payments + journal rows) only **reads** `attachments` JSON — upload fixes above cover COA-related flows on mobile.

### Non-negotiable rules

1. **Upload** — All attachment uploads go through [`storageAttachmentPipeline.ts`](../../erp-mobile-app/src/utils/storageAttachmentPipeline.ts) (`uploadStorageAttachmentFile`). Do not add new direct `supabase.storage.upload(ArrayBuffer)` paths in API modules.
2. **Native images** — On Capacitor, **image** paths (`.jpg`, `.png`, `.webp`, `.gif`) use blob download via [`shouldUseNativeBlobDisplay`](../../erp-mobile-app/src/utils/storageDisplayUrl.ts) in `getStorageDisplayUrl`. **PDF** stays signed URL.
3. **Corrupt server objects** — Historic ~2 B files stay broken until **re-upload** (same as product photos).
4. **Product photos** — Remain in [`productImageUpload.ts`](../../erp-mobile-app/src/utils/productImageUpload.ts); locked under Section A.

### Verification checklist (build 33 APK)

1. Sale → attach JPG → save → preview opens (debug log: `sale-attachments upload ok`, blob bytes >> 256).
2. Purchase PO attachment (image).
3. Payment sheet → attach receipt photo (customer/supplier payment).
4. Accounts → transfer / journal → attach PDF + JPG.
5. Expense → receipt photo.
6. Old attachment with `bytes=2` in log → re-upload only.

### Locked files (mobile attachments)

- `erp-mobile-app/src/utils/storageAttachmentPipeline.ts`
- `erp-mobile-app/src/api/sales.ts` (`uploadSaleAttachments`)
- `erp-mobile-app/src/api/purchases.ts` (`uploadPurchaseAttachments`)
- `erp-mobile-app/src/api/paymentAttachments.ts`
- `erp-mobile-app/src/api/journalAttachments.ts`
- `erp-mobile-app/src/api/expenses.ts` (`uploadExpenseReceipt`)
- `erp-mobile-app/src/utils/storageDisplayUrl.ts` (`isStorageImagePath`, `shouldUseNativeBlobDisplay`, `bustStorageDisplayCache`)

---

## Section E — Bespoke / customization stock (web canonical)

### Intended lifecycle (do not break)

| Step | Stock |
|------|--------|
| Sale `draft` / `quotation` / `order` | **No** sale OUT |
| Bespoke work order **complete** | Fabric OUT + custom parent IN via `complete_bespoke_work_order` |
| Sale → `final` | OUT only for lines **not** deferred (see `filterSaleLinesForStockPosting`) |

**Double OUT** historically came from `ensure_sale_stock_movements` posting CUSTOM/fabric lines while WO also posts — fixed in migration `20260602160000_ensure_sale_stock_bespoke_parity.sql` (parity with `handle_sale_final_stock_movement`).

### Non-negotiable rules

1. **Web** — Stock eligibility: [`src/app/lib/saleStockLineEligibility.ts`](../../src/app/lib/saleStockLineEligibility.ts); finalize path: [`SalesContext.tsx`](../../src/app/context/SalesContext.tsx).
2. **DB** — `handle_sale_final_stock_movement`, `complete_bespoke_work_order`, `ensure_sale_stock_movements` (post-migration) must stay aligned.
3. **Mobile** — **Never** insert `stock_movements` from the client; use RPCs only (`ensure_sale_stock_movements`, `complete_bespoke_work_order`, `updateSaleStatus` → final).
4. **One parent line → one work order**; N custom lines → N WOs.

### Locked files (bespoke)

- `src/app/lib/saleStockLineEligibility.ts`
- `src/app/services/bespokeWorkOrderService.ts`
- `migrations/20260602120000_bespoke_defer_stock_to_work_order_complete.sql`
- `migrations/20260602150000_bespoke_wo_parent_stock_in_sign.sql`
- `migrations/20260602160000_ensure_sale_stock_bespoke_parity.sql`
- `erp-mobile-app/src/api/bespokeWorkOrders.ts` (mobile RPC wrapper)
- `erp-mobile-app/src/hooks/useBespokeEnabled.ts`

Rollout: [`BESPOKE_MOBILE_ROLLOUT.md`](BESPOKE_MOBILE_ROLLOUT.md)

---

## Section B — Stock display (locked)

### Rule (single source for UI qty)

When the company has **any** row in `stock_movements` (for the selected branch scope):

- **Display stock** = `SUM(stock_movements.quantity)` per product / variation (and box/piece deltas from movement columns).
- **`inventory_balance` is not used** for overview/grid/report qty (it can be stale after sale/return until triggers catch up).

When there are **zero** `stock_movements` for the scope (e.g. fresh company after reset, before first transaction):

- **`inventory_balance`** may be used as fallback for simple products only.

### Canonical code path

```
stock_movements
  → inventoryService.fetchOverviewStockMaps()
  → inventoryService.getInventoryOverview()
  → UI components (below)
```

Implementation: [`src/app/services/inventoryService.ts`](../../src/app/services/inventoryService.ts) — `companyHasStockMovements`, `fetchInBatches` on `stock_movements`, `applyMovementRowsToStockMaps`.

Ledger **lines** use `productService.getStockMovements()` (same underlying table); ledger **header** `currentStock` comes from `getInventoryOverview` row passed from the grid.

### UI surfaces (must stay linked)

| Screen | Component | Stock API |
|--------|-----------|-----------|
| Inventory Management | `InventoryDesignTestPage` | `getInventoryOverview(companyId, branchId)` |
| Products list | `ProductsPage` | `getInventoryOverview(companyId, null)` — **company-wide** qty |
| Stock Report | `StockReportPage` | `getInventoryOverview` |
| Inventory dashboard | `InventoryDashboardNew` | `getInventoryOverview` |
| POS | `POS` via `fetchBranchStockMaps` | Same `fetchOverviewStockMaps` helper |
| Stock ledger modal | `FullStockLedgerView` | Header: overview `currentStock`; lines: `getStockMovements` |

**Do not** read `inventory_balance` or legacy `products.current_stock` directly in these UIs for displayed qty.

### Verification checklist

1. Pick one SKU after sale + return (or adjustment).
2. Confirm **same number** on: Inventory **Stock** column, Products stock badge, Stock Report **current stock**, ledger **current balance** (header).
3. Console: during normal ops, should **not** see stale warning `inventory_balance has rows but no stock_movements` (old hybrid path).

### Known intentional difference

- **Products** page uses `branchId: null` (all branches aggregated).
- **Inventory** page respects global branch filter.

A per-branch Products grid is a **feature change**, not a bug fix — do not “fix” mismatch by reverting to `inventory_balance`.

### Mobile ERP (same rule)

| Screen | Component | Stock API |
|--------|-----------|-----------|
| Products list | `ProductsModule` | `getProducts` → `fetchProductStockByKey` (movements-first) |
| POS / sales pickers | `POSModule`, `AddProducts`, purchases | `getProducts` (same helper) |
| Inventory module | `getInventory` in `api/inventory.ts` | Always `stock_movements` |

**Locked:** `erp-mobile-app/src/utils/productStockFetch.ts` — must not prefer `inventory_balance` when `companyHasStockMovements` is true.

### Locked files (stock display)

- `src/app/services/inventoryService.ts` (`fetchOverviewStockMaps`, `getInventoryOverview`)
- `erp-mobile-app/src/utils/productStockFetch.ts`
- Callers listed in the tables above (do not bypass with balance table reads)

---

## Section C — Deploy and change policy

### VPS deploy (required for production)

```bash
ssh dincouture-vps "cd /root/NEWPOSV3 && git pull origin main && bash deploy/deploy.sh"
```

- Rebuilds ERP Docker image (Vite bundle + nginx.conf in image).
- Do **not** rely only on `docker cp` nginx into a running container for long-term fixes.

After deploy: hard refresh browser; verify Section A and B checklists once.

### Change policy

Any PR that touches **locked files** in Section A, B, D, or E must:

1. Update this document if behavior or verification steps change.
2. Get explicit approval for production display / storage / inventory contract changes.
3. Run post-deploy smoke (sign, upload, one SKU stock parity).

---

## Commit reference (initial lock)

| Area | Notes |
|------|--------|
| Photos | `eb33544`, `dbeff5a`, `5cf5ecf` (path strip, PWA, nginx storage/jpg) |
| Stock | `fetchOverviewStockMaps` movements-first (same commit series as this doc) |
