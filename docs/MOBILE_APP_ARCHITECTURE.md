# ERP Mobile App — Architecture & Steps

**Scope:** `erp-mobile-app/` only. Do not modify web ERP code.

---

## Structure

```
erp-mobile-app/
  src/
    api/           # Supabase / backend calls
    lib/           # supabase, offlineStore, syncEngine
    context/       # Permission, auth
    hooks/
    features/
      barcode/     # Barcode scanner (ML Kit)
    components/
      pos/         # POS (cart, payment, scan)
      sales/
      settings/
      ...
```

---

## Implementation Order

| Step | Focus | Status |
|------|--------|--------|
| **1** | **Barcode scanning** | ✅ Done |
| **2** | **Thermal printer (POS)** | ⏳ Settings done; hardware plugin optional |
| **3** | **Mobile POS screens** | ✅ Done (POSHome, Cart, Payment, Receipt in POSModule) |
| **4** | **Offline sync** | ✅ Done (IndexedDB queue, syncEngine) |

---

## Step 1 — Barcode Scanning ✅

- **Folder:** `src/features/barcode/`
- **Files:** `BarcodeScanner.tsx`, `barcodeService.ts`, `useBarcodeScanner.ts`, `index.ts`
- **Plugin:** `@capacitor-mlkit/barcode-scanning`
- **Flow:** Scan → return code → POS calls `getProductByBarcodeOrSku(companyId, code)` → add to cart.
- **Permissions:** Android `CAMERA`; iOS `NSCameraUsageDescription`.
- **Product API:** `api/products.ts` → `getProductByBarcodeOrSku(companyId, code)` (barcode first, then SKU).

---

## Step 2 — Thermal Printer (POS)

- **Settings:** Already in Settings → Printer: mode (A4 / thermal), paper size (58mm / 80mm), auto-print receipt. Stored via `settingsApi.getMobilePrinterSettings` / `setMobilePrinterSettings`.
- **Hardware (optional):** For actual device printing use a Capacitor plugin (e.g. `@capacitor-community/bluetooth-le` or thermal printer plugin). Not required for app to function; receipt can be viewed/shared without hardware.

---

## Step 3 — Mobile POS Screens ✅

- **POSModule** provides: product grid, search, **Scan** button (barcode), cart drawer, checkout, payment dialog, success (invoice no).
- **Screens in one flow:** POS home (grid + scan) → Cart (drawer) → Payment (dialog) → Receipt (success message with invoice no).

---

## Step 4 — Offline Sync ✅

- **IndexedDB** queue in `lib/offlineStore.ts`.
- **Sync engine** in `lib/syncEngine.ts`.
- **Supported entities:** sale, expense, journal_entry, payment (and related).
- **Settings:** Sync now, unsynced count, clear cache in Settings.

---

## Auto-Apply (CI / Local)

- **Web ERP migrations:** From repo root run `npm run migrate` (or `npm run dev` which can run migrate with `--allow-fail`). Uses `scripts/run-migrations.js`; applies `supabase-extract/migrations/` then `migrations/`.
- **Mobile:** No DB migrations. After code changes: `cd erp-mobile-app && npm run build:mobile && npx cap sync` then open Android/iOS.

---

## Summary

- **Done:** Barcode, POS (with scan), offline sync, printer/barcode settings UI.
- **Optional:** Thermal printer hardware plugin when a device is chosen.
- **Do not:** Add features outside this order; do not modify web ERP from mobile app tasks.
