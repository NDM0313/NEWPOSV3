# ERP Mobile — release log (APK + iOS)

Copy a new block for every build. Keep the newest entry at the top.

---

## Latest build — 1.0.5 (build 33) — 2026-06-01

| Field | Value |
|--------|--------|
| **Date** | 2026-06-01 |
| **versionName** | 1.0.5 |
| **versionCode** | 33 |
| **Configuration** | Release (signed) |
| **APK path (local)** | `releases/erp-mobile-1.0.5-build33.apk` |

### Changelog (user-facing) — build 33

- **Fix:** Sale, purchase, payment, journal, and expense attachments use the same native-safe upload as product photos (`storageAttachmentPipeline.ts`).
- **Fix:** Image attachment preview on APK uses native blob download for all buckets (not only product-images).
- **Product photos:** Unchanged (build 32 pipeline locked).
- **Company logo (web only):** Settings logo upload needs `company-logos` bucket on server — not fixed by APK; see [`docs/COMPANY_LOGOS_STORAGE.md`](../../docs/COMPANY_LOGOS_STORAGE.md).
- Build locally: [`BUILD_AND_GRAPHIFY_COMMANDS.md`](BUILD_AND_GRAPHIFY_COMMANDS.md).

### Install notes (build 33)

1. `npm run android:apk:release:win` from `erp-mobile-app`.
2. Install `releases/erp-mobile-1.0.5-build33.apk`.
3. Re-attach or re-upload old broken attachment files (2-byte server objects).

---

## Previous build — 1.0.5 (build 32) — 2026-06-01

| Field | Value |
|--------|--------|
| **Date** | 2026-06-01 |
| **versionName** | 1.0.5 |
| **versionCode** | 32 |
| **Configuration** | Release (signed) |
| **APK path (local)** | `releases/erp-mobile-1.0.5-build32.apk` |

### Changelog (user-facing) — build 32

- **Fix:** Native storage upload sends binary correctly (XHR + Blob, then fetch-Blob, then CapacitorHttp `dataType: base64`) — stops 2-byte corrupt files on server.
- **All buckets** on APK use native upload first (product images, sale/purchase attachments, receipts).
- **Product photos:** Try `File` upload via supabase-js before ArrayBuffer path; clearer Roman Urdu error if server file too small.
- Build locally: [`BUILD_AND_GRAPHIFY_COMMANDS.md`](BUILD_AND_GRAPHIFY_COMMANDS.md).

### Install notes (build 32)

1. `npm run android:apk:release:win` from `erp-mobile-app`.
2. Install `releases/erp-mobile-1.0.5-build32.apk`.
3. Re-upload photos that failed with "file too small" on build 31.

---

## Previous build — 1.0.5 (build 31) — 2026-06-01

| Field | Value |
|--------|--------|
| **Date** | 2026-06-01 |
| **versionName** | 1.0.5 |
| **versionCode** | 31 |
| **Configuration** | Release (signed) |
| **APK path (local)** | `releases/erp-mobile-1.0.5-build31.apk` |

### Changelog (user-facing) — build 31

- **Blob cache:** Stores `byteSize`; evicts cache hits under 256 bytes (no stale 2-byte blob URLs).
- **Upload verify:** After native upload, re-downloads object; throws if server file is still tiny.
- **Debug:** HTTP status + tiny-body preview in log (`{}` etc.).
- Operator commands: [`BUILD_AND_GRAPHIFY_COMMANDS.md`](BUILD_AND_GRAPHIFY_COMMANDS.md).

### Install notes (build 31)

1. Build locally: `npm run android:apk:release:win` (see BUILD_AND_GRAPHIFY_COMMANDS.md).
2. Install `releases/erp-mobile-1.0.5-build31.apk`.
3. Re-upload broken product photos (old 2-byte server files stay broken until replaced).

---

## Previous build — 1.0.5 (build 30) — 2026-06-01

| Field | Value |
|--------|--------|
| **Date** | 2026-06-01 |
| **versionName** | 1.0.5 |
| **versionCode** | 30 |
| **Configuration** | Release (signed) |
| **APK path (local)** | `releases/erp-mobile-1.0.5-build30.apk` |

### Changelog (user-facing) — build 30

- **Fix:** WebView `supabase.storage.download` often returned **2-byte junk** (not a real JPEG). APK now rejects tiny blobs and uses **native CapacitorHttp download** first for product images.
- **Upload:** Product image upload uses **native upload first** on APK so new photos are full-size on server.
- Re-upload photos that still show broken after install (old 2-byte objects may remain in storage).

### Install notes (build 30)

1. Uninstall build 29 or older.
2. Install **`releases/erp-mobile-1.0.5-build30.apk`**.
3. For broken thumbs: edit product → take/upload photo again → save.

---

## Previous build — 1.0.5 (build 29) — 2026-05-25

| Field | Value |
|--------|--------|
| **Date** | 2026-05-25 |
| **versionName** | 1.0.5 |
| **versionCode** | 29 |
| **Configuration** | Release (signed) |
| **APK path (local)** | `releases/erp-mobile-1.0.5-build29.apk` |

### Changelog (user-facing) — build 29

- **In-app debug log (Developer Tools):** Settings → tap **App version** 7× → **Debug log** panel captures `[StorageUrl]` / product-image pipeline steps on device (no USB `adb` required). **Share** exports log text for support.
- **Connection Debug** on APK when Developer Mode unlocked (runtime Supabase API URL).
- Includes build 28 product-photo native download pipeline.

### Install notes (build 29)

1. Uninstall build 28 or older.
2. Install **`releases/erp-mobile-1.0.5-build29.apk`**.
3. To diagnose broken thumbs: Settings → App version ×7 → scroll **Debug log** → open Products → **Share** log.

---

## Previous build — 1.0.5 (build 28) — 2026-05-25

| Field | Value |
|--------|--------|
| **Date** | 2026-05-25 |
| **versionName** | 1.0.5 |
| **versionCode** | 28 |
| **Configuration** | Release (signed) |
| **APK path (local)** | `releases/erp-mobile-1.0.5-build28.apk` |

### Changelog (user-facing) — build 28

- **Product photos (APK):** Images load via native **CapacitorHttp download** (same technique as upload) into blob URLs — WebView never loads broken HTTPS signed URLs.
- Pipeline: supabase download → native authenticated GET → signed URL fetched natively → `blob:` for `<img>`.
- Includes build 27 cache-bust + URL normalize.

### Install notes (build 28)

1. Uninstall build 27 or older.
2. Install **`releases/erp-mobile-1.0.5-build28.apk`**.

---

## Previous build — 1.0.5 (build 27) — 2026-05-25

| Field | Value |
|--------|--------|
| **Date** | 2026-05-25 |
| **versionName** | 1.0.5 |
| **versionCode** | 27 |
| **Configuration** | Release (signed) |
| **APK path (local)** | `releases/erp-mobile-1.0.5-build27.apk` |
| **QA log** | [`MOBILE_QA_LOG.md`](MOBILE_QA_LOG.md) |

### Changelog (user-facing) — build 27

- **Product photos on APK:** Native display uses authenticated storage download (blob) first; signed URLs stay on `erp.dincouture.pk` (no broken WebView GET to direct Supabase host).
- **After camera/gallery save:** Storage display cache busted so list/detail/edit thumbs refresh immediately.
- **Legacy image URLs:** Normalized to `product-images/...` refs when loading product list.
- Includes build 26 (rental thumbs, duration picker, inventory transfer).

### Install notes (build 27)

1. **Uninstall** ERP Mobile (build 26 or older).
2. Install **`releases/erp-mobile-1.0.5-build27.apk`** only.
3. Products → Add → camera → Save → **list thumb must appear** without reopening app.

### Mobile test checklist (build 27)

| # | Area | Verify |
|---|------|--------|
| 1 | APK camera upload | New product + photo → Save → list thumb visible |
| 2 | APK replace image | Edit → replace → thumb updates |
| 3 | Broken product (- 55 -) | Detail/edit shows image or honest No photo |
| 4 | Rental grid | Photo on card when `image_urls` exist |
| 5 | Web `/m/` regression | Upload still works |

### VPS deploy (web PWA)

Push commits first, then:

```bash
ssh dincouture-vps "cd /root/NEWPOSV3 && git pull && bash deploy/add-kong-cors-erp-origin.sh"
```

APK images are Supabase Storage; VPS only affects web `/m/` bundle.

---

## Previous build — 1.0.5 (build 26) — 2026-05-25

| Field | Value |
|--------|--------|
| **APK path (local)** | `releases/erp-mobile-1.0.5-build26.apk` |

Rental thumbs, duration picker, inventory `TRANSFER` fix.

---

## Latest build — 1.0.5 (build 25) — 2026-05-31

| Field | Value |
|--------|--------|
| **Date** | 2026-05-31 |
| **versionName** | 1.0.5 |
| **versionCode** | 25 |
| **Configuration** | Release (signed) |
| **APK path (local)** | `releases/erp-mobile-1.0.5-build25.apk` |

### Changelog (user-facing) — build 25

- **Product photo upload (APK):** Camera/gallery preview now saves to server — storage upload uses native CapacitorHttp fallback when WebView fetch fails (PWA `/m/` unchanged).
- Includes build 24 image update/replace fixes.

### Install notes (build 25)

1. **Uninstall** ERP Mobile (build 24 or older).
2. Install **`releases/erp-mobile-1.0.5-build25.apk`** only.
3. Add/Edit product with camera → Save → thumb must appear on list (not preview-only).

### Mobile test checklist (build 25)

| # | Area | Verify |
|---|------|--------|
| 1 | Camera save | New product + camera photo → list thumb after save |
| 2 | Gallery save | Gallery pick → save → thumb on list |
| 3 | Update image | Preview sheet → Update image → new thumb |
| 4 | chrome://inspect | `POST .../storage/v1/object/product-images/...` **200** on APK |
| 5 | PWA `/m/` | Upload still works (regression) |

---

## Previous build — 1.0.5 (build 24) — 2026-05-31

| Field | Value |
|--------|--------|
| **Date** | 2026-05-31 |
| **versionName** | 1.0.5 |
| **versionCode** | 24 |
| **Configuration** | Release (signed) |
| **APK path (local)** | `releases/erp-mobile-1.0.5-build24.apk` |

### Changelog (user-facing) — build 24

- **Update product image:** Replacing a photo from the preview sheet or edit form now updates the visible thumb (`image_urls[0]`); no silent “success” with old picture still showing.
- **Preview sheet:** Replace primary on Update; cache bust + merge product state after save.

### Install notes (build 24)

1. **Uninstall** ERP Mobile (build 23 or older).
2. Install **`releases/erp-mobile-1.0.5-build24.apk`** only.
3. Products → tap product thumb → **Update image** → new photo must appear in preview and list.

### Mobile test checklist (build 24)

| # | Area | Verify |
|---|------|--------|
| 1 | Update image | Preview sheet → Update image → thumb changes |
| 2 | List thumb | Product row shows new image without stale cache |
| 3 | Edit add photo | New pick becomes primary without deleting old manually |
| 4 | Camera/gallery | Build 23 camera + gallery regression still OK |

---

## Previous build — 1.0.5 (build 23) — 2026-05-31

| Field | Value |
|--------|--------|
| **Date** | 2026-05-31 |
| **versionName** | 1.0.5 |
| **versionCode** | 23 |
| **Configuration** | Release (signed) |
| **APK path (local)** | `releases/erp-mobile-1.0.5-build23.apk` |

### Changelog (user-facing) — build 23

- **Product camera photos:** Take photo on Add/Edit product reads image via Capacitor Filesystem (Android-safe); preview and upload work like gallery picks.
- **Errors:** Clear message if camera capture or image upload fails (product still saves when applicable).
- **Stock (from build 22+):** Product list qty from `stock_movements` when company has movements.

### Install notes (build 23)

1. **Uninstall** ERP Mobile (build 22 or older).
2. Install **`releases/erp-mobile-1.0.5-build23.apk`** only.
3. **Products** → Add product → **Take photo** → confirm blue-ring preview → Save → list thumb visible.
4. Regression: gallery pick and existing product thumbs still load.

### Mobile test checklist (build 23)

| # | Area | Verify |
|---|------|--------|
| 1 | Camera add | Add product → Take photo → preview → Save → thumb on list |
| 2 | Camera edit | Edit product → Take photo → extra thumb after save |
| 3 | Gallery regression | Choose from gallery still previews and uploads |
| 4 | Products list | Existing photos still show after scroll |
| 5 | Upload failure | If offline upload fails, error text shown (not silent) |

---

## Previous build — 1.0.5 (build 22) — 2026-05-31

| Field | Value |
|--------|--------|
| **Date** | 2026-05-31 |
| **versionName** | 1.0.5 |
| **versionCode** | 22 |
| **Configuration** | Release (signed) |
| **APK path (local)** | `releases/erp-mobile-1.0.5-build22.apk` |

### Changelog (user-facing) — build 22

- **Product photos (APK):** Native thumbs use authenticated `storage.download` → blob URL (primary path). Signed `<img>` URLs use direct `supabase.dincouture.pk` host (PWA parity). Removed bogus public-URL fallback for private `product-images` bucket.
- **Lists:** Product/POS/inventory thumbs load when scrolled into view (less sign storm on cold start).
- **Sale attachments:** Native upload fallback via patched fetch + CapacitorHttp when WebView `fetch` fails.

### Install notes (build 22)

1. **Uninstall** ERP Mobile (build 21 or older).
2. Install **`releases/erp-mobile-1.0.5-build22.apk`** only.
3. Sign in → **Products** → scroll list; thumbnails should appear within a few seconds.
4. Optional: complete a sale with one photo attachment (no `Failed to fetch`).

### Mobile test checklist (build 22)

| # | Area | Verify |
|---|------|--------|
| 1 | Products list | 3+ items with photos show thumbs after scroll |
| 2 | Cold start | Re-open app → Products thumbs within ~5s |
| 3 | POS grid | Product cards show images when visible |
| 4 | PWA regression | `https://erp.dincouture.pk/m/` products still OK |
| 5 | Sale attachment | Upload 1 image on sale; no fetch error |

---

## Previous build — 1.0.5 (build 21) — 2026-05-31

| Field | Value |
|--------|--------|
| **Date** | 2026-05-31 |
| **versionName** | 1.0.5 |
| **versionCode** | 21 |
| **Configuration** | Release (signed) |
| **APK path (local)** | `releases/erp-mobile-1.0.5-build21.apk` |

### Changelog (user-facing) — build 21

- **VPS sync:** Push + full ERP deploy so web hosting matches localhost (login, products, settings, migrations).
- **Web product photos:** Sign path-only `image_urls`; no invalid `img src` on failure.
- **Mobile:** ERP proxy, storage auth retry, CORS upload headers on VPS nginx.

### Install notes (build 21)

1. Uninstall older ERP Mobile → install **`releases/erp-mobile-1.0.5-build21.apk`** only.
2. Web: hard refresh after deploy (`Ctrl+Shift+R`).

---

## Previous build — 1.0.5 (build 20) — 2026-05-31

| Field | Value |
|--------|--------|
| **Date** | 2026-05-31 |
| **versionName** | 1.0.5 |
| **versionCode** | 20 |
| **Configuration** | Release (signed) |
| **APK path (local)** | `releases/erp-mobile-1.0.5-build20.apk` |

### Changelog (user-facing) — build 20

- **Product photos (root fix):** Thumbnails re-sign after login when session becomes ready (fixes all "No photo" on build 19). Auth errors (401) are no longer cached for 5 minutes. Session wait/retry before storage sign.
- **Web ERP (same deploy):** Products table signs path-only `image_urls` from web upload (was only signing URLs containing `/product-images/`).

### Install notes (build 20)

1. **Uninstall** ERP Mobile (build 19 or older).
2. Install **`releases/erp-mobile-1.0.5-build20.apk`** only.
3. Sign in → open **Products**; photos should load within a few seconds.
4. **Web:** hard-refresh Products page after VPS deploy (`Ctrl+Shift+R`).

---

## Previous build — 1.0.5 (build 19) — 2026-05-31

| Field | Value |
|--------|--------|
| **Date** | 2026-05-31 |
| **versionName** | 1.0.5 |
| **versionCode** | 19 |
| **Configuration** | Release (signed) |
| **APK path (local)** | `releases/erp-mobile-1.0.5-build19.apk` |

### Changelog (user-facing) — build 19

- **Product photos on APK:** Safer signed-URL host rewrite (keeps Supabase-encoded path/query). Native storage signing is throttled (max 6 concurrent) so the Products list does not stampede storage and cache "No photo" for 5 minutes.
- **Cache:** Signed URL cache clears on login / token refresh so failed signs before session ready do not stick.
- Requires build **18+** ERP proxy (`https://erp.dincouture.pk`); build 19 fixes display on top of that.

### Install notes (build 19)

1. **Uninstall** ERP Mobile (build 18 or older).
2. Install **`releases/erp-mobile-1.0.5-build19.apk`** only.
3. Sign in with email/password (same as PWA).
4. **Products** → thumbnails for items that show photos on `https://erp.dincouture.pk/m/`.

### Mobile test checklist (build 19)

| # | Area | Verify |
|---|------|--------|
| 1 | Login | Email/password works |
| 2 | Products list | Items with PWA photos show thumbnails (not all "No photo") |
| 3 | Product tap | Preview opens image |
| 4 | Sales → Add Products | Same product photos visible |

---

## Previous build — 1.0.5 (build 18) — 2026-05-31

| Field | Value |
|--------|--------|
| **Date** | 2026-05-31 |
| **versionName** | 1.0.5 |
| **versionCode** | 18 |
| **Configuration** | Release (signed) |
| **APK path (local)** | `releases/erp-mobile-1.0.5-build18.apk` |

### Changelog (user-facing) — build 18

- **APK login fix (CORS):** Native app now calls **`https://erp.dincouture.pk`** for auth/REST/storage (nginx proxy), not direct `supabase.dincouture.pk`. Kong echoes PWA origins but not `capacitor://localhost`; ERP nginx does (`access-control-allow-origin: capacitor://localhost`).
- Builds 16–17 used direct Supabase + password grant — still blocked by CORS on device.

### Install notes (build 18)

1. **Uninstall** ERP Mobile (build 17 or older).
2. Install **`releases/erp-mobile-1.0.5-build18.apk`** only.
3. Sign in with email/password (same as PWA).
4. Product photos / uploads use ERP proxy path (same CORS as login).

---

## Previous build — 1.0.5 (build 17) — 2026-05-31

| Field | Value |
|--------|--------|
| **Date** | 2026-05-31 |
| **versionName** | 1.0.5 |
| **versionCode** | 17 |
| **Configuration** | Release (signed) |
| **APK path (local)** | `releases/erp-mobile-1.0.5-build17.apk` |

### Changelog (user-facing) — build 17

- **APK login fix:** Native app now uses the same direct GoTrue password grant as PWA (`erp.dincouture.pk/m/`). Build 16 still called `signInWithPassword` from the WebView, which failed cross-origin and showed “Cannot reach the server” even after uninstall.
- **Support:** Network login errors on APK mention installing the latest build when PWA works.

### Install notes (build 17)

1. **Uninstall** ERP Mobile (build 16 or older).
2. Install `releases/erp-mobile-1.0.5-build17.apk` — **not** build 16.
3. Sign in with email/password (same account as PWA).
4. Product photo upload should work (Kong storage CORS already fixed on VPS).

---

## Previous build — 1.0.5 (build 16) — 2026-05-31

| Field | Value |
|--------|--------|
| **Date** | 2026-05-31 |
| **versionName** | 1.0.5 |
| **versionCode** | 16 |
| **Configuration** | Release (signed) |
| **APK path (local)** | `releases/erp-mobile-1.0.5-build16.apk` |
| **Supabase API** | `https://supabase.dincouture.pk` (anon synced from VPS Kong `ANON_KEY`) |

### Changelog (user-facing) — build 16

- **Login on APK:** release build bakes current VPS anon JWT (`sync-env-from-vps.mjs`); fixes “Cannot reach the server” when local key was stale (Kong CORS for `capacitor://localhost` verified on VPS).
- **Settings crash:** ErpPrinter Bluetooth list no longer crashes WebView on Android 12+ without runtime `BLUETOOTH_CONNECT`; paired devices load only when **Printer & barcode** section is opened.
- **Settings:** screen-level error boundary with Go back / Reload.

### Install notes (build 16)

1. **Uninstall** any previous ERP Mobile app (required — clears old WebView cache and auth storage).
2. Install `releases/erp-mobile-1.0.5-build16.apk`.
3. Sign in with email/password — must not show red network error.
4. Open **Settings** from home — screen must stay open (no instant crash).
5. Optional: **Printer & barcode** → Thermal → grant Bluetooth if prompted → pick paired printer.

### Operator: rebuild with VPS key

```bash
cd erp-mobile-app
npm run sync:mobile:env:vps    # or falls back to local .env
npm run android:apk:release:win
```

---

## Previous build — 1.0.5 (build 12) — 2026-05-21

| Field | Value |
|--------|--------|
| **Date** | 2026-05-21 |
| **versionName** | 1.0.5 |
| **versionCode** | 12 |
| **Git commit** | `eeb32fa` (local changes on top) |
| **Android** | Debug (unsigned test) — **production web build** (`cap:sync:android:prod`) |
| **APK path (local)** | `releases/erp-mobile-1.0.5-build12-debug.apk` |
| **Gradle source** | `android/app/build/outputs/apk/debug/app-debug.apk` |

### Changelog (user-facing) — build 12

- **Counter PIN session:** fast-path when same user still logged in; vault sync on POS lock submit + app resume; fresh token on counter PIN enrollment.
- **Attachments (sale/purchase/payment):** no more `localhost:5174` URLs on mobile — unified storage signing + VPS backfill to `bucket/path` refs.
- **Product images:** same unified storage URL module; production APK uses `https://erp.dincouture.pk`.
- **PDF Share/Download/Print:** native share uses `Share.files` + cache FileProvider URI (WhatsApp/Drive attach works).

### VPS migrations applied (build 12)

- `20260530120000_backfill_attachment_urls_to_path.sql`

### Install notes — Android (build 12 debug)

1. **Uninstall** previous ERP Mobile app.
2. Install: `erp-mobile-app/releases/erp-mobile-1.0.5-build12-debug.apk`  
   `adb install -r releases/erp-mobile-1.0.5-build12-debug.apk`
3. If counter PIN shows session expired for a user: tap **Sign in with email for {name}** once, then PIN works again.
4. Sale attachments uploaded from web dev should preview on APK after VPS backfill.

### Mobile test checklist (build 12)

| # | Area | Verify |
|---|------|--------|
| 1 | Counter PIN | Re-lock same user — no session expired |
| 2 | Sale attachments | Preview opens (not localhost WebView error) |
| 3 | Product images | Thumbnails on APK |
| 4 | Invoice PDF Share | Share sheet attaches PDF file |
| 5 | Counter enroll | New counter PIN works immediately |

---

## Previous build — 1.0.5 (build 11) — 2026-05-21

| Field | Value |
|--------|--------|
| **Date** | 2026-05-21 |
| **versionName** | 1.0.5 |
| **versionCode** | 11 |
| **Git commit** | `eeb32fa` (local changes on top) |
| **Android** | Debug (unsigned test) |
| **APK path (local)** | `releases/erp-mobile-1.0.5-build11-debug.apk` |
| **Gradle source** | `android/app/build/outputs/apk/debug/app-debug.apk` |

### Changelog (user-facing) — build 11

- **Double PIN fixed:** POS lock screen is the only counter gate — no second user picker after unlock.
- **Counter session:** stale vault refresh no longer signs you out globally on PIN failure; vault maintenance runs on POS lock screen.
- **Product images (APK):** native signed URLs always use production host; RPC fallback + DB backfill for full URLs → path-only.
- **Invoice PDF (APK):** Share / PDF / Print use native Capacitor Share + Filesystem (system share sheet).

### VPS migrations applied (build 11)

- `20260529120000_get_product_image_signed_url_rpc.sql`
- `20260529120001_backfill_product_image_urls_full_to_path.sql`

### Install notes — Android (build 11 debug)

1. **Uninstall** any previous ERP Mobile app (clears WebView cache).
2. Install: `erp-mobile-app/releases/erp-mobile-1.0.5-build11-debug.apk`  
   `adb install -r releases/erp-mobile-1.0.5-build11-debug.apk`
3. Counter unlock: tap name → 4-digit PIN → straight into app (no second login screen).
4. PDF preview: Share opens Android share sheet with PDF attached.

### Mobile test checklist (build 11)

| # | Area | Verify |
|---|------|--------|
| 1 | Counter PIN | POS lock only — single PIN unlock into home/sales |
| 2 | Counter login | No "session expired" loop after POS unlock |
| 3 | Sales → Add Products | Product photos load on APK |
| 4 | Invoice PDF | Share / PDF / Print open native share or save |
| 5 | Soft logout | POS lock again with single PIN |

---

## Previous build — 1.0.5 (build 10) — 2026-05-24

| Field | Value |
|--------|--------|
| **Date** | 2026-05-24 |
| **versionName** | 1.0.5 |
| **versionCode** | 10 |
| **Git commit** | `eeb32fa` |
| **Android** | Debug (unsigned test) |
| **APK path (local)** | `releases/erp-mobile-1.0.5-build10-debug.apk` |
| **Gradle source** | `android/app/build/outputs/apk/debug/app-debug.apk` |

### Changelog (user-facing) — build 10

- **Counter PIN session:** re-lock follows Settings window (7d / unlimited) — switching apps briefly no longer forces PIN every time.
- **Counter vault:** refreshes persisted Supabase session on counter login screen before PIN entry (reduces false "session expired").
- **Set Quick PIN:** timeout aligned with counter session policy (no short 30s override).
- **Product images (Android/iOS):** signed URLs on Sales Add Products + Inventory; path-only storage; VPS backfill for localhost dev URLs.
- **Sale posting:** salesman Confirm Payment uses `ensure_sale_stock_movements` RPC (no 403 on stock).

### Install notes — Android (build 10 debug)

1. **Uninstall** any previous ERP Mobile app (clears WebView cache).
2. Install: `erp-mobile-app/releases/erp-mobile-1.0.5-build10-debug.apk`  
   `adb install -r releases/erp-mobile-1.0.5-build10-debug.apk`
3. If counter PIN shows "session expired" after VPS deploy: one email login on that tablet, then PIN works again.
4. Settings → **PIN session freshness** → 7 days or Unlimited for longest counter session.

### Mobile test checklist (build 10)

| # | Area | Verify |
|---|------|--------|
| 1 | Counter PIN | Switch apps and return within 7d — no immediate re-lock |
| 2 | Counter login | Nadeem PIN works without "session expired" (after one email login if vault was stale) |
| 3 | Sales → Add Products | Product photos show on APK (not "No photo" for web-uploaded items) |
| 4 | Salesman Confirm Payment | Sale saves; no 403 |
| 5 | Product upload | Photo upload works on Android/iOS |

---

## Previous build — 1.0.5 (build 9) — 2026-05-24

| Field | Value |
|--------|--------|
| **Date** | 2026-05-24 |
| **versionName** | 1.0.5 |
| **versionCode** | 9 |
| **Git commit** | `dc71f969` |
| **Android** | Release (signed) |
| **APK path (local)** | `releases/erp-mobile-1.0.5-build9.apk` (~28 MB) |
| **Gradle source** | `android/app/build/outputs/apk/release/app-release.apk` |
| **iOS** | `cap:sync:ios:prod` + Archive/Export (Development signing) |
| **IPA path (local)** | `releases/erp-mobile-1.0.5-build9.ipa` (~3.4 MB) |
| **Built on** | Mac — `cap:sync:android:prod` + `./gradlew assembleRelease` |

### Changelog (user-facing) — build 9

- **Lead registration link:** company + branch in URL; WhatsApp / Email / Copy share from Contacts.
- **Public leads:** list shows `Ref: …` from link until approved; **Pending lead** badge; admin **Approve** assigns `CUS-xxxx`.
- **Products:** list thumb shows photo or “No photo”; tap opens preview.
- **Invoice PDF:** centered company header (table layout for print).
- **Counter PIN:** background-only re-lock; 7-day policy sync; email login hidden when counter slots exist.
- Includes build 8: sale stock RPC, negative stock setting, native barcode scan.

### Install notes — Android (build 9 release)

1. **Uninstall** any previous ERP Mobile app (especially debug builds 7/8 — different signing key).
2. Install: `erp-mobile-app/releases/erp-mobile-1.0.5-build9.apk`  
   `adb install -r releases/erp-mobile-1.0.5-build9.apk`
3. Release signing uses `android/app/release-key.jks` (generated on build machine if missing). Keep keystore backup for future updates.
4. API base: `https://erp.dincouture.pk` (from `.env.production` at sync time).

### Install notes — iOS (build 9)

1. Install via Xcode **Devices**, Apple Configurator, or MDM: `releases/erp-mobile-1.0.5-build9.ipa` (Apple Development profile — device must be on your team).
2. Or: `npx cap open ios` → scheme **NDM ERP** → Run on connected iPhone.
3. Archive: `ios/build/App.xcarchive`. Ad Hoc / TestFlight needs **iOS Distribution** certificate in Xcode.

### Mobile test checklist (build 9)

| # | Area | Verify |
|---|------|--------|
| 1 | Contacts → link icon | Share link has `company` + `branch`; WhatsApp/Email work |
| 2 | Public register → Contacts (web) | New lead shows `Ref:`; Approve → `CUS-xxxx` |
| 3 | Products list | Thumb shows image or “No photo” |
| 4 | Sales invoice PDF | Centered company block |
| 5 | Counter PIN | No re-lock on in-app navigation; re-lock after background |

---

## Previous build — 1.0.5 (build 8) — 2026-05-24

| Field | Value |
|--------|--------|
| **Date** | 2026-05-24 |
| **versionName** | 1.0.5 |
| **versionCode** | 8 |
| **Git commit** | `74c847d0` (+ `versionCode` bump local) |
| **VPS migrations** | `20260527120000_get_company_negative_stock_allowed.sql`, `20260527140000_ensure_sale_stock_movements_rpc.sql` — **applied** |
| **Android** | Debug (unsigned test) |
| **APK path (local)** | `releases/erp-mobile-1.0.5-build8-debug.apk` (~30 MB) |
| **Gradle source** | `android/app/build/outputs/apk/debug/app-debug.apk` |
| **Built on** | Mac — `cap:sync:android:prod` + `./gradlew assembleDebug` |

### Changelog (user-facing) — build 8

- **Sale posting fix:** salesman Confirm Payment no longer fails with 403 on `stock_movements` (uses `ensure_sale_stock_movements` RPC).
- **Negative stock:** company-wide setting applies to all roles when admin enables it (Sales/POS product pickers).
- **Performance:** faster product/stock load; reduced Settings render loop; lighter app bootstrap.
- Includes build 7: native barcode scan (Add Products), Settings accordions, branch `"all"` UUID fix.

### Install notes — Android (build 8 debug)

1. **Uninstall** any previous ERP Mobile app (clears WebView cache and IndexedDB).
2. Install: `erp-mobile-app/releases/erp-mobile-1.0.5-build8-debug.apk`  
   `adb install -r releases/erp-mobile-1.0.5-build8-debug.apk`
3. Debug builds use a different signing key than release build 5 — uninstall is required if install fails with signature conflict.
4. Cold boot: splash ~2s, then login. API base: `https://erp.dincouture.pk`.
5. One **email login** after VPS deploy if counter PIN vault expired.

### Mobile test checklist (build 8)

| # | Area | Verify |
|---|------|--------|
| 1 | Salesman → New Sale → Confirm Payment | Sale saves; no 403 on `stock_movements` |
| 2 | Negative stock ON (admin) → salesman Add Products | Out-of-stock items selectable |
| 3 | Cold boot | Login within ~15s |
| 4 | Sales → Scan / POS Scan | Native camera still works (build 7 regression) |
| 5 | All Branches payment | No `uuid: "all"` toast |
| 6 | Settings accordions | Counter + Printer expand OK |

---

## Previous build — 1.0.5 (build 7) — 2026-05-23

| Field | Value |
|--------|--------|
| **Date** | 2026-05-23 |
| **versionName** | 1.0.5 |
| **versionCode** | 7 |
| **Git commit** | `17a753e` |
| **Android** | Debug (unsigned test) |
| **APK path (local)** | `releases/erp-mobile-1.0.5-build7-debug.apk` (~30 MB) |
| **Gradle source** | `android/app/build/outputs/apk/debug/app-debug.apk` |
| **Built from** | `main` after pull `83262ae` + migrations commit |

### Changelog (user-facing) — build 7

- **Barcode scan (Add Products):** native ML Kit camera on Android/iOS — Sales → Add Items → **Scan** (no browser `BarcodeDetector` error).
- **Settings UX:** accordions — only **Account & branch** open by default; **Counter & lock screen** and **Printer & barcode** expand on tap.
- **Branch "all" UUID fix:** payment / expense with **All Branches** no longer sends `uuid: "all"` to RPCs.
- Includes build 6: My Activity, counter PIN session policy, Shipment & Cargo UI.

### Install notes — Android (build 7 debug)

1. **Uninstall** any previous ERP Mobile app (clears WebView cache and IndexedDB).
2. Install: `erp-mobile-app/releases/erp-mobile-1.0.5-build7-debug.apk`  
   `adb install -r releases/erp-mobile-1.0.5-build7-debug.apk`
3. Debug builds use a different signing key than release build 5 — uninstall is required if install fails with signature conflict.
4. Cold boot: splash ~2s, then login. API base: `https://erp.dincouture.pk`.
5. Settings → **Printer & barcode** → method **Camera** for native scan.

### Mobile test checklist (build 7)

| # | Area | Verify |
|---|------|--------|
| 1 | Cold boot | Login within ~15s (not endless blue) |
| 2 | All Branches payment | No `uuid: "all"` toast |
| 3 | Settings | Accordions collapsed; Counter + Printer expand OK |
| 4 | Sales → Add Items → Scan | Native camera; EAN adds product |
| 5 | POS Scan | Regression OK |
| 6 | Counter PIN | One email login if vault expired after VPS deploy |

---

## Previous build — 1.0.5 (build 6) — 2026-05-23

| Field | Value |
|--------|--------|
| **Date** | 2026-05-23 |
| **versionName** | 1.0.5 |
| **versionCode** | 6 |
| **Git commit** | `2a5dad94` (VPS deployed); local mobile assets may include uncommitted `gradle.properties` fix |
| **VPS** | `dincouture-vps` — migrations + `deploy.sh` OK; `post_sale_shipment_journal` applied |
| **GoTrue audit** | PASS (4 checks, 0 WARN) — no auth `.env` changes |
| **Android** | Debug (unsigned test) |
| **APK path (local)** | `releases/erp-mobile-1.0.5-build6-debug.apk` (~31 MB) |
| **Gradle source** | `android/app/build/outputs/apk/debug/app-debug.apk` |
| **iOS** | `cap:sync:ios:prod` + Archive/Export OK |
| **IPA path (local)** | `releases/erp-mobile-1.0.5-build6.ipa` (Development signing) |

### Changelog (user-facing) — build 6

- **My Activity:** date presets (7 / 15 / month), **Created by** on rows and detail sheet, balance masking (`****`) for workers.
- **Accounts:** larger KPI typography; fund tiles masked when user cannot view balances.
- **Counter PIN / session:** vault token maintenance, configurable max age (Settings), advisories on lock screens; after VPS deploy do **one email login** per tablet if PIN shows expired vault.
- **Shipment & Cargo:** status/dates UI; backend `post_sale_shipment_journal` (requires VPS migration `20260526120000` — applied).

### Install notes — Android (build 6 debug)

1. **Uninstall** any previous ERP Mobile app (clears WebView cache and IndexedDB).
2. Install: `erp-mobile-app/releases/erp-mobile-1.0.5-build6-debug.apk`  
   `adb install -r releases/erp-mobile-1.0.5-build6-debug.apk`
3. Debug builds use a different signing key than release build 5 — uninstall is required if install fails with signature conflict.
4. Cold boot: splash ~2s, then login. API base: `https://erp.dincouture.pk` (from `.env.production` at sync time).
5. If counter PIN fails after deploy: **log in once with email/password**, then use PIN again.

### Install notes — iOS (build 6)

1. Install via Xcode **Devices** window, Apple Configurator, or MDM using `releases/erp-mobile-1.0.5-build6.ipa` (Development profile — device must be registered in your Apple team).
2. Or connect iPhone → `npx cap open ios` → scheme **NDM ERP** → **Product → Run**.
3. Archive on disk: `ios/build/App.xcarchive` (re-export with Xcode Organizer if you need Ad Hoc / TestFlight).

### Mobile test checklist (post-install)

| Area | Verify |
|------|--------|
| **Counter PIN** | Settings → session policy; PIN after hours; one email login if vault expired |
| **My Activity** | Date chips, Created by, masked balances (worker) |
| **Shipment & Cargo** | Dates/status; journal after dispatch (needs VPS migration — live) |
| **Accounts** | Larger KPIs (owner); `****` on fund tiles (worker) |

---

## Previous build — 1.0.4 (build 5)

| Field | Value |
|--------|--------|
| **Date** | 2026-05-21 |
| **versionName** | 1.0.4 |
| **versionCode** | 5 |
| **Configuration** | Release (signed) |
| **APK path (local)** | `releases/erp-mobile-1.0.4-build5.apk` |

### Changelog (user-facing) — build 5

- Physical device WebView boot fix: relative `./assets/` paths (not absolute `/assets/`), single inlined JS bundle (~2.4 MB), ES5-safe boot watchdog, splash auto-hides after 2s so login/fallback is visible.

### Install notes (build 5)

1. **Uninstall** any previous ERP Mobile app (clears WebView cache and IndexedDB).
2. Install `releases/erp-mobile-1.0.4-build5.apk`.
3. Cold boot: splash ~2s, then login screen OR boot fallback with **Reload app** button.
4. If still plain blue after 12s: `adb logcat | findstr /i "chromium capacitor ERP Failed"`

---

## Previous build (1.0.3 build 4)

| Field | Value |
|--------|--------|
| **Date** | 2026-05-21 |
| **versionName** | 1.0.3 |
| **versionCode** | 4 |
| **APK path (local)** | `releases/erp-mobile-1.0.3-build4.apk` |

### Changelog (user-facing) — build 4

- Fix release APK blank/blue boot screen: Vite WebView-compatible transpile targets, dist verification before cap sync, pre-React boot fallback UI, lazy-loaded modules, auth bootstrap timeout.
- Register native ErpPrinter plugin on Android startup (printing).

### Install notes (build 4)

1. **Uninstall** the old 1.0.2 app first (clears WebView cache and IndexedDB).
2. Install `releases/erp-mobile-1.0.3-build4.apk`.
3. Cold boot should show the login screen (dark UI). If startup fails, you should see a **Reload app** fallback instead of a blank screen.
4. If still blank: connect tablet via USB and run `adb logcat | findstr /i "chromium capacitor ERP"`.

---

## Previous build (1.0.2 build 3)

- Settings **Thermal / A4** now drives real printing (Sunmi built-in → Bluetooth ESC/POS → browser A4).
- **Test print** in Settings; Bluetooth printer picker for paired devices.
- **Auto-print receipt** after Sale and POS checkout when enabled.
- **Print labels** on Products (barcode/SKU) with thermal or A4 layout.
- Salesman can save printer settings (RLS fix for `auth_user_id` users).

---

## Previous build (1.0.1 build 2)

| Field | Value |
|--------|--------|
| **Date** | 2026-05-20 |
| **versionName** | 1.0.1 |
| **versionCode** | 2 |
| **Git commit** | `9912cfe` |
| **Configuration** | Release (signed) |
| **APK path (local)** | `android/app/build/outputs/apk/release/app-release.apk` (copy: `releases/erp-mobile-1.0.1-build2.apk` for uploads) |
| **Download URL** | Create release on GitHub (see below). Intended tag: `mobile-v1.0.1-build2`. |

### Create the GitHub Release (APK upload)

`gh` was not available on the Windows build machine. On any machine with [GitHub CLI](https://cli.github.com/) installed and authenticated (`gh auth login`):

**Windows (from repo root):**

```powershell
powershell -ExecutionPolicy Bypass -File .\erp-mobile-app\releases\publish-github-release.ps1
```

**Or manually from repo root:**

```bash
gh release create mobile-v1.0.1-build2 \
  --title "ERP Mobile 1.0.1 (build 2) — Shared counter PIN" \
  --notes-file erp-mobile-app/releases/GH_RELEASE_NOTES_mobile-v1.0.1-build2.md \
  erp-mobile-app/releases/erp-mobile-1.0.1-build2.apk
```

Or use **GitHub → Releases → Draft a new release**: tag `mobile-v1.0.1-build2`, upload `erp-mobile-app/releases/erp-mobile-1.0.1-build2.apk`, paste the contents of `erp-mobile-app/releases/GH_RELEASE_NOTES_mobile-v1.0.1-build2.md` as the description.

### Changelog (user-facing)

- Shared counter / POS lock screen: enrolled users, device-bound refresh tokens in vault, logout → lock when enrolled.
- **Counter tablet PIN** in Settings is available to **all staff** with a concrete branch (not only owner/admin).
- **Unique 4-digit PIN per person** on the tablet: saving a PIN already used by another login is blocked (prevents overwriting the other user’s slot).
- First-login **Set PIN**: optional counter vault enroll when PIN is exactly 4 digits and branch resolves via profile.
- Skip POS lock immediately after interactive email login + Set PIN (where applicable).

### Notes for installers

- Uninstall old debug builds if package signature conflicts.
- After Web ERP module toggles change, users should **log out and log in** on mobile.
- Each cashier must pick a **different** 4-digit counter PIN on the same tablet.

---

## Build entry (template)

| Field | Value |
|--------|--------|
| **Date** | YYYY-MM-DD |
| **versionName** | e.g. 1.0.1 (must match `android/app/build.gradle` `defaultConfig`) |
| **versionCode** | integer (must match `android/app/build.gradle`) |
| **Git commit** | short SHA from `git rev-parse --short HEAD` |
| **Configuration** | Debug / Release |
| **APK path (local)** | e.g. `android/app/build/outputs/apk/release/app-release.apk` |
| **Download URL** | optional: Drive / portal / internal server |

### Changelog (user-facing)

- …

### Notes for installers

- Uninstall old debug builds if package signature conflicts.
- After Web ERP module toggles change, users should **log out and log in** on mobile.
