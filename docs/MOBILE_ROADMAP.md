# Mobile Completion Roadmap

Focus: **mobile completion, performance, device testing**. No new features; complete existing flows and harden.

---

## ✅ STEP 1 — Barcode → Product Lookup (DONE)

- **Flow:** Scan barcode → `getProductByBarcodeOrSku` → auto-add to cart.
- **Done:** `AddProducts.tsx`: `processBarcode()` uses API when local list has no match; auto-add (qty 1) or open modal for variations. Success/error message. POS already used API.

---

## ✅ STEP 2 — External Barcode Scanner (DONE)

- **Hardware:** Speed-X, Sunmi, CS60 (keyboard wedge: scanner injects barcode into text field + Enter).
- **Done:** Dedicated “Scan barcode (Speed-X, Sunmi, CS60)…” input in Add Products (when method = keyboard_wedge) and in POS. On Enter → lookup + add to cart and clear field.

---

## ✅ STEP 3 — Mobile POS Screen (DONE)

- **Flow:** Scan → Cart → Payment → Invoice.
- **Done:** `POSModule`: BarcodeScanner + keyboard wedge input → cart → PaymentDialog → createSale → success/invoice. Main mobile use case covered.

---

## ✅ STEP 4 — Offline Queue System (DONE)

- **Flow:** Offline sale → queue → sync when internet returns.
- **Done:** POS + Sales queue via `addPending('sale', ...)`; sync on `online` and every 60s; SyncStatusBar `onSyncClick`; sale handler with orderDate/deadline.

---

## ✅ STEP 5 — Packing List Mobile (DONE)

- **Flow:** Sale → Packing list → Shipment (wholesale).
- **Done:** `api/packingList.ts`; PackingListModule; screen `packing` in Home + App.

---

## ✅ STEP 6 — Mobile Courier Shipment Modal (DONE)

- **Fields:** Courier, tracking number, shipment cost, weight.
- **Done:** `api/couriers.ts`, `api/shipments.ts`; ShipmentModal; "Shipment" button per sale in Packing list.

---

## ✅ STEP 7 — Mobile Ledger (Read-Only) (DONE)

- **Scope:** Customer ledger only: balance + last N transactions.
- **Done:** `api/customerLedger.ts`; LedgerModule; screen `ledger`.

---

## ✅ STEP 8 — Performance (Web) (DONE)

- **Issue:** Main chunk ~4.27 MB.
- **Done:** React.lazy for Dashboard, ReportsDashboard, SalesPage, StockDashboard in web App; Suspense wrappers.

---

## STEP 9 — Device Testing

- **Devices:** Sunmi V2 Pro, Android phone, iPhone, tablet.
- **Test:** Barcode (camera + keyboard wedge), POS (scan → cart → payment → invoice), printing (if applicable), sync.
- **Checklist:** `docs/DEVICE_TESTING.md`.

---

## ✅ STEP 10 — Production Deploy (auto-apply ready)

- **Target:** erp.dincouture.pk (web + API). Mobile: build and distribute (Capacitor).
- **Auto-apply:** `npm run deploy:prepare` (web) or `.\scripts\prepare-deploy.ps1` (Windows; add `-Mobile` for mobile build). Doc: `docs/PRODUCTION_DEPLOY.md`.

---

## Priority Order

1. ✅ Barcode lookup + keyboard wedge  
2. ✅ POS flow  
3. Offline queue + sync (Step 4)  
4. Performance – chunk split (Step 8)  
5. Packing list UI (Step 5)  
6. Shipment modal (Step 6)  
7. Customer ledger read-only (Step 7)  
8. Device testing (Step 9)  
9. ✅ Production deploy prep – auto-apply (Step 10)
