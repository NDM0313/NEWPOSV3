# ERP Mobile — QA / bug log

Append-only. **Newest entry at the top.** Use when testing APK builds or reporting device issues.

## Entry template

| Field | Value |
|--------|--------|
| **Date** | YYYY-MM-DD |
| **Build** | versionName + versionCode (e.g. 1.0.5 / 26) |
| **Area** | Module / screen |
| **Steps** | Numbered repro |
| **Expected** | |
| **Actual** | |
| **Status** | open / fixed / watch |

---

## 2026-06-02 — build 34 (bespoke + sale document status)

| Field | Value |
|--------|--------|
| **Area** | Sales create + detail; bespoke work orders; purchase draft |
| **Steps** | Enable `enable_bespoke_orders` → new sale → **Order** → add CUSTOM-* line → Customize → fabric → save → open sale → create/complete WO → **Convert to Final** |
| **Expected** | No stock on order save; fabric OUT + parent IN on WO complete; sale OUT only on final; ledger matches web |
| **Actual** | `createSale` uses `targetStatus`; stock RPC only on `final`; `ensure_sale_stock_bespoke_parity` on VPS required |
| **Status** | verify on device + VPS migration |

**Sale status matrix**

| Status | Stock on save | Payment |
|--------|---------------|---------|
| draft / quotation / order | No | Optional / deferred |
| final | `ensure_sale_stock_movements` + accounting RPC | Required flow |

**Purchase:** Create flow supports **Draft** / **Order** / **Received** (stock on received/final path).

**Backend (VPS before production bespoke):** [`migrations/20260602160000_ensure_sale_stock_bespoke_parity.sql`](../../migrations/20260602160000_ensure_sale_stock_bespoke_parity.sql) — see [`docs/infra/BESPOKE_MOBILE_ROLLOUT.md`](../../docs/infra/BESPOKE_MOBILE_ROLLOUT.md).

---

## 2026-06-01 — build 33 (attachments shared pipeline)

| Field | Value |
|--------|--------|
| **Area** | Sale / purchase / payment / journal / expense attachments |
| **Steps** | Build 33 → attach JPG on sale → preview; payment receipt; expense receipt; account transfer attachment |
| **Expected** | `sale-attachments upload ok` (or bucket tag), image preview blob bytes >> 256; PDF via signed URL |
| **Actual** | `uploadStorageAttachmentFile` + `shouldUseNativeBlobDisplay` for all image paths |
| **Status** | verify on device |

**COA / transactions:** Payment + journal upload APIs updated; transaction list reads existing `attachments` JSON.

**Web company logo:** Toast `Bucket 'company-logos' not found` is **web Settings**, not APK — apply [`docs/COMPANY_LOGOS_STORAGE.md`](../../docs/COMPANY_LOGOS_STORAGE.md) on Supabase.

---

## 2026-06-01 — build 32 (native upload binary fix)

| Field | Value |
|--------|--------|
| **Area** | Product photo + sale/purchase attachments upload |
| **Steps** | Build 32 APK → upload compressed photo → Debug log |
| **Expected** | `upload xhr ok` or `fetch-blob ok`, `post-upload verify ok`, `stored` ≈ `sent` (200KB+) |
| **Actual** | Fixed Capacitor ArrayBuffer JSON corruption; native-first all buckets |
| **Status** | verify on device |

---

## 2026-06-01 — build 30/31 (2-byte storage objects)

| Field | Value |
|--------|--------|
| **Area** | Products → image upload / thumb |
| **Steps** | Share debug log from build 30. |
| **Expected** | `bytes` in thousands after upload and download. |
| **Actual** | `reject invalid blob from signed-url \| bytes=2` — object on server is ~2 bytes (corrupt upload). Build 30 rejects display; build 31 adds post-upload verify + cache byteSize guard. |
| **Status** | fixed in code (build 31); **re-upload** required per product |

**Storage verify (dashboard):**  
`product-images/597a5292-14c8-4cd8-96bd-c61b5a0d8c92/335a566a-b559-418c-95a1-471345c8821c/507604b2-c072-4f6f-a9d9-69604bba9118.jpg` — if size = 2 B, replace file.

**Local build/install:** [`BUILD_AND_GRAPHIFY_COMMANDS.md`](BUILD_AND_GRAPHIFY_COMMANDS.md).

---

## 2026-05-25 — build 29 (in-app debug log for product images)

| Field | Value |
|--------|--------|
| **Area** | Settings → Developer Tools → Debug log |
| **Steps** | 1. Install build 29. 2. Settings → App version tap ×7. 3. Open Products (broken thumb SKU). 4. Return Settings → Debug log → Share. |
| **Expected** | Log shows pipeline: `ProductImage resolve` → `StorageUrl blob download` → success or explicit fail (404, 0 bytes, auth missing). |
| **Actual** | New: `mobileDebugLog.ts` + `MobileDebugLogSection`; instrumented storage pipeline. |
| **Status** | open (verify on device, share log for root cause) |

---

## 2026-05-25 — build 27 (APK product image display)

| Field | Value |
|--------|--------|
| **Area** | Products → list / detail / edit thumbs |
| **Steps** | 1. Install build 27 on Pixel 6 Pro. 2. Add product with camera → Save. 3. Open product - 55 - detail. |
| **Expected** | APK-uploaded photos visible; no broken `<img>` icon; blob or ERP-signed URL loads. |
| **Actual** | Fixed: removed native signed-URL rewrite to `supabase.dincouture.pk`; blob-first `ProductImage`; `bustProductImageDisplayCache` on save; `normalizeProductImageUrls` on read. |
| **Status** | fixed (verify on device) |

| Field | Value |
|--------|--------|
| **Area** | Products images — APK vs localhost |
| **Steps** | Same as build 26 watch item after build 27 install. |
| **Expected** | APK matches production storage (not localhost Vite proxy). |
| **Actual** | Pending device sign-off. |
| **Status** | watch |

---

## 2026-05-25 — build 26 (pending device verify)

| Field | Value |
|--------|--------|
| **Area** | Rental → Create → Products grid |
| **Steps** | 1. Open product with photo in Products module. 2. Rental → New → pick customer → products step. |
| **Expected** | Grid card and cart show product thumb via `ProductImage`. |
| **Actual** | Was empty placeholder; fixed: `getRentalProducts` now selects `image_urls`. |
| **Status** | fixed (pending build 26) |

| Field | Value |
|--------|--------|
| **Area** | Rental → Create → Duration |
| **Steps** | 1. Select items → Duration. 2. On phone/tablet with sidebar layout, open pickup/return dates. |
| **Expected** | Date controls fit content width; no horizontal overflow. |
| **Actual** | Native `type="date"` overflowed; fixed: `DateInputField` wheel picker. |
| **Status** | fixed (pending build 26) |

| Field | Value |
|--------|--------|
| **Area** | Inventory → Transfer stock |
| **Steps** | 1. Multi-branch → Transfer 1 unit A→B → Save. |
| **Expected** | Saves; ledger shows TRANSFER movements. |
| **Actual** | `movement_type_check` failed on `transfer_in`/`transfer_out`; fixed: use `TRANSFER`. |
| **Status** | fixed (build 26+) |

| Field | Value |
|--------|--------|
| **Area** | Products images — APK vs localhost |
| **Steps** | 1. Dev: localhost update product image. 2. Install APK build 26. 3. Products list + Rental grid. |
| **Expected** | APK shows same image (Supabase storage + signed URL). |
| **Actual** | Localhost dev uses Vite proxy; APK uses `https://erp.dincouture.pk`. |
| **Status** | watch — verify on device after build 26 |

| Field | Value |
|--------|--------|
| **Area** | VPS Kong CORS (build 27) |
| **Steps** | `ssh dincouture-vps` → `git pull` → `bash deploy/add-kong-cors-erp-origin.sh` |
| **Expected** | Capacitor origins allowed on Kong for storage/auth. |
| **Actual** | 2026-05-25 build 27: pull Already up to date; Kong CORS script ran — No change, Kong recreated. Push git commits to deploy new `/m/` JS. APK 27 is local-only until installed on device. |
| **Status** | done (infra); push code for web bundle |

---

## How to log a new issue

1. Copy the template table.
2. Add under this file (top).
3. Link build number from [`APK_UPDATE.md`](APK_UPDATE.md).
