# Mobile App Architecture

**Project:** `erp-mobile-app` (Capacitor + React + Vite).  
**Backend:** Supabase (same as web ERP).

---

## Modules

| Module | Path / entry | Purpose |
|--------|----------------|--------|
| **barcode** | `src/features/barcode/` | Scan (camera + external), product lookup, inventory scan. |
| **sales** | `SalesModule`, `SalesHome`, `AddProducts`, `SaleConfirmation`, `MobileReceivePayment` | Create sale, add products, receive payment. |
| **products** | `ProductsModule`, `AddProductFlow` | List/add products; variations. |
| **inventory** | `InventoryModule`, `InventoryReports` | Stock view; reports. |
| **customers** | `ContactsModule`, `AddContactFlow`, `EditContactFlow` | Contacts (customer/supplier). |
| **offline sync** | `SyncStatusBar`, `useNetworkStatus`, (future: queue + sync) | Network status; planned offline queue and sync. |

Additional: **purchase**, **accounting**, **studio**, **rental**, **reports**, **settings**, **dashboard**, **pos** (POSModule).

---

## Flow: Barcode → Product → Cart → Payment → Sync

```
1. Barcode
   - Camera: BarcodeScanner / BarcodeCameraModal → scanBarcode() → code.
   - External: (optional) keyboard/scanner input as barcode.
   - Product lookup: getProductBySkuOrBarcode(code) → product.

2. Add to cart
   - Sales flow: AddProducts or sale line items; add product + qty.
   - Cart state: local state or context (e.g. sale form state).

3. Payment
   - MobileReceivePayment: amount, method; call record_customer_payment or equivalent.
   - Sale finalization: mark sale final; post accounting if applicable.

4. Sync
   - Online: direct Supabase; SyncStatusBar shows “Synced”.
   - Offline (future): queue mutation; on reconnect run sync job (upload queue, resolve conflicts).
```

---

## Key Files

| Layer | Files |
|-------|--------|
| **Barcode** | `features/barcode/index.ts`, `useBarcodeScanner.ts`, `barcodeService.ts`, `BarcodeScanner.tsx`; `BarcodeCameraModal.tsx` in sales. |
| **Sales** | `api/sales.ts`, `SalesHome.tsx`, `AddProducts.tsx`, `SaleConfirmation.tsx`, `MobileReceivePayment.tsx`. |
| **Products** | `api/products.ts`, `AddProductFlow.tsx`, `ProductsModule.tsx`. |
| **Inventory** | `InventoryModule.tsx`, `InventoryReports.tsx`. |
| **Customers** | `api/contacts.ts`, `AddContactFlow.tsx`, `EditContactFlow.tsx`. |
| **Offline** | `SyncStatusBar.tsx`, `hooks/useNetworkStatus.ts`; secure storage: `lib/secureStorage.ts`. |

---

## Data & Auth

- **API:** Supabase client (shared with web); env via `sync-mobile-env.js`.
- **Auth:** Login screen → session; branch selection.
- **Storage:** `secureStorage` for tokens/sensitive data; no full offline DB yet.

---

## Platform

- **Capacitor:** iOS/Android; native camera for barcode.
- **Build:** `npm run build` (Vite); then Capacitor sync and native build (see `CAPACITOR.md`, `README_BUILD.md` in erp-mobile-app).
