# ERP display lock — product photos + stock (LOCKED)

**Status:** Locked for production (`erp.dincouture.pk`, Capacitor APK, PWA `/m/`).  
**Purpose:** Prevent regressions where product thumbnails fail or inventory qty disagrees across screens.

Do **not** change the behaviors below in drive-by refactors without explicit product-owner approval and an update to this file.

---

## Related docs

| Doc | Role |
|-----|------|
| [`AUTH_PRODUCTION_LOCKED.md`](AUTH_PRODUCTION_LOCKED.md) | Auth, Kong, ERP nginx `/auth` `/rest` |
| [`MOBILE_APK_LOCKED_PATTERN.md`](MOBILE_APK_LOCKED_PATTERN.md) | Native Supabase URL (Capacitor) |
| [`PRODUCT_IMAGES_STORAGE_RLS_FIX.md`](../PRODUCT_IMAGES_STORAGE_RLS_FIX.md) | Storage RLS + bucket setup |
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
4. **APK:** Install only `erp-mobile-app/releases/erp-mobile-1.0.5-build22.apk` (or newer documented build); `chrome://inspect` → `storage/v1` download/sign **200**.

### Locked files (product photos)

- `src/app/utils/productImageUpload.ts`
- `src/app/components/products/ProductImage.tsx`
- `deploy/nginx.conf` (`location /storage/` + static asset regex)
- `vite.config.ts` (PWA workbox)
- `src/main.tsx` (SW registration)
- `erp-mobile-app/src/utils/storageDisplayUrl.ts`
- `erp-mobile-app/src/utils/productImageUpload.ts`

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

### Locked files (stock display)

- `src/app/services/inventoryService.ts` (`fetchOverviewStockMaps`, `getInventoryOverview`)
- Callers listed in the table above (do not bypass with balance table reads)

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

Any PR that touches **locked files** in Section A or B must:

1. Update this document if behavior or verification steps change.
2. Get explicit approval for production display / storage / inventory contract changes.
3. Run post-deploy smoke (sign, upload, one SKU stock parity).

---

## Commit reference (initial lock)

| Area | Notes |
|------|--------|
| Photos | `eb33544`, `dbeff5a`, `5cf5ecf` (path strip, PWA, nginx storage/jpg) |
| Stock | `fetchOverviewStockMaps` movements-first (same commit series as this doc) |
