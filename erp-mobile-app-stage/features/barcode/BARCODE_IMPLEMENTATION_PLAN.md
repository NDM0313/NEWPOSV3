# Barcode Module Implementation Plan

**Location:** `erp-mobile-app/src/features/barcode/`  
**Current:** Native scan (Capacitor ML Kit), hook, service; web fallback via `BarcodeCameraModal` (BarcodeDetector API).

---

## 1. Camera scanning

| Item | Status | Action |
|------|--------|--------|
| Native (iOS/Android) | Done | `@capacitor-mlkit/barcode-scanning`; `barcodeService.scanBarcode()` opens camera, returns first code. |
| Permissions | Done | `checkCameraPermission`, `requestCameraPermission` in barcodeService; hook exposes `requestPermission`. |
| Web fallback | Done | `BarcodeCameraModal` uses `BarcodeDetector` + getUserMedia (Chrome/Android). |
| UX | Optional | On unsupported web: show “Type barcode or use external scanner” and/or manual input. |

**Implementation:** Keep current flow. Ensure `BarcodeScanner` or `BarcodeCameraModal` is used in Sales/AddProducts so “Scan” is visible; add manual barcode input field where useful.

---

## 2. External scanner support

| Item | Status | Action |
|------|--------|--------|
| Bluetooth/USB scanner | Not implemented | Many devices act as **keyboard wedge**: they type the barcode + Enter. |
| Listen for key events | Partial | Add a dedicated “scan input” field that listens for rapid key input ending in Enter; treat as barcode. |
| Dedicated scan field | Optional | Single focused input: user focuses field, scans with external device; on Enter resolve as barcode. |

**Implementation:**

- Add optional “External scanner” input: one text field, focus on “Scan with scanner”, on `keydown`/`keypress` collect characters, on Enter submit collected string as barcode and clear.
- Or: in existing product search, if input is a single line ending with Enter and looks like a barcode (e.g. numeric/length), treat as barcode and run product lookup.

---

## 3. Product lookup

| Item | Status | Action |
|------|--------|--------|
| By barcode/SKU | API dependent | Ensure products API supports filter by `sku` or `barcode` (or search term). |
| After scan | Partial | `onScan(code)` in BarcodeScanner; caller should call product lookup and add to cart. |
| Not found | Optional | Show “Product not found for code X”; allow add by name or skip. |

**Implementation:**

- In `AddProducts` (or equivalent): on `onScan(code)` call `getProductBySkuOrBarcode(code)` (implement using existing products API: filter by sku or barcode column).
- If product found: add to sale line items and optionally focus qty. If not found: toast + optional manual search.

---

## 4. Inventory scan

| Item | Status | Action |
|------|--------|--------|
| Scan to view stock | Not implemented | From inventory screen: scan barcode → show product + stock (and location if applicable). |
| Scan to adjust | Optional | Scan → product → quick adjust (e.g. +/- quantity). |

**Implementation:**

- Inventory screen: add “Scan” button using same `useBarcodeScanner` + `scanBarcode()`.
- On scan: product lookup by barcode → fetch stock for product (existing inventory API) → show bottom sheet or modal with product name, SKU, current stock.
- Optional: “Adjust” button in that modal to run existing stock adjustment flow for that product.

---

## 5. File layout (current)

```
erp-mobile-app/src/
  features/barcode/
    index.ts           # Public API
    barcodeService.ts # Native ML Kit + permissions
    useBarcodeScanner.ts
    BarcodeScanner.tsx # Button + permission state
  components/sales/
    BarcodeCameraModal.tsx # Web BarcodeDetector fallback
```

---

## 6. Suggested order of work

1. **Product lookup:** Implement or wire `getProductBySkuOrBarcode(code)` and use it in Add Products on scan.
2. **External scanner:** Add optional “Scan with external scanner” input (keyboard wedge) and parse Enter as barcode.
3. **Inventory scan:** Add “Scan” to inventory screen → product lookup → show stock (and optional adjust).
4. **UX polish:** Prominent “Scan” in sales; “Not found” message; optional manual barcode field when camera unavailable.

---

## 7. Dependencies

- **Native:** `@capacitor-mlkit/barcode-scanning` (already used).
- **Web:** No extra deps; `BarcodeDetector` and `getUserMedia` are built-in where supported.
