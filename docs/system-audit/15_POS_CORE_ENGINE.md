# 15 — POS Core Engine

> Last updated: 2026-04-12

---

## Business Purpose

Point of Sale is a fast, fullscreen checkout terminal for walk-in retail customers. It is designed for high-volume transactions where speed matters: a cashier scans or taps products, optionally selects a registered customer or stays with the "Walk-in Customer" default, applies a discount, and proceeds to payment. The POS does not have a quotation or draft lifecycle — every checkout produces a finalised, numbered sale immediately. Today's revenue totals are displayed in the header to give cashiers a running tally.

---

## UI Entry Points

| Surface | Route / View | Component |
|---------|-------------|-----------|
| POS terminal | `view: pos` | `src/app/components/pos/POS.tsx` |
| Payment collection | Opened from within POS after cart is confirmed | `src/app/components/shared/UnifiedPaymentDialog.tsx` |
| POS sale browsing | Prev / Next navigation inside POS.tsx | Inline within `POS.tsx` (filtered by `invoice_no LIKE 'POS-%'`) |

The POS runs fullscreen (`setCurrentView('pos')` via `NavigationContext`). No separate route slug is used — the app uses view-based navigation rather than URL routing.

---

## Frontend Files

| File | Role |
|------|------|
| `src/app/components/pos/POS.tsx` | Main terminal: product grid, cart, customer picker, discount, checkout, edit mode, today stats |
| `src/app/context/SalesContext.tsx` | `createSale()`, `updateSale()`, `refreshSales()` — shared with regular sales |
| `src/app/services/saleService.ts` | `getSaleById()`, `getSalePayments()`, `getSalesReport()` — queried directly from POS |
| `src/app/services/productService.ts` | `getAllProducts()` — loads POS product grid |
| `src/app/services/contactService.ts` | `getAllContacts()` — populates customer dropdown |
| `src/app/services/settingsService.ts` | `getAllowNegativeStock()` — DB-level stock policy enforcement |
| `src/app/components/shared/UnifiedPaymentDialog.tsx` | Payment collection after POS sale is created |
| `src/app/context/SettingsContext.tsx` | `posSettings` — UI preferences (e.g. wholesale toggle) |
| `src/app/hooks/useFormatCurrency.ts` | Currency formatting throughout POS |
| `src/app/utils/stockCalculation.ts` | `calculateStockFromMovements()` — branch-scoped stock overlay |

---

## Backend Services

The POS does **not** use a separate service. It uses the same `saleService.ts` and `SalesContext.createSale()` path as regular sales:

- `createSale(saleData)` in `SalesContext.tsx` is called with `isPOS: true` set on the payload.
- The `isPOS` flag triggers `docType = 'pos'` and `sequenceType = 'PS'`, producing a `PS-NNNN` number via `documentNumberService.getNextDocumentNumberGlobal(companyId, 'PS')`.
- After the sale row is created, `UnifiedPaymentDialog` records the payment using the same `saleService` payment path used for regular invoices.
- Accounting (JE) is triggered by `postSaleDocumentAccounting(data.id)` inside `saleService.createSale()` — same document posting engine as regular sales.

---

## DB Tables

POS uses the same tables as regular sales — there is no separate POS-specific table.

| Table | Usage |
|-------|-------|
| `sales` | One row per POS transaction; `invoice_no` starts with `POS-` (global numbering) or `PS-NNNN` (ERP numbering) |
| `sales_items` | Line items for the POS cart |
| `payments` | Payment records for completed POS sales (via `UnifiedPaymentDialog`) |
| `stock_movements` | Negative movement per item on sale finalisation (same trigger as regular sale) |
| `journal_entries` + `journal_entry_lines` | Accounting JE posted by `postSaleDocumentAccounting()` |

The POS list in the UI filters by `invoice_no.startsWith('POS-')` (legacy prefix check in `POS.tsx` line 125) and `saleService` maps `^POS-` to type `'PS'` (line 139 in `saleService.ts`).

---

## POS Sale Create Flow

```
1. Cashier adds products to cart
   ↓ addToCart() — merges qty if product already in cart
   ↓ If product has variations → variationModalProduct state → pick variation then addToCart()

2. Cashier selects customer (optional)
   ↓ selectedCustomer state; default = "walk-in"

3. Cashier applies discount
   ↓ discountType: 'percentage' | 'amount'
   ↓ discountAmount computed from subtotal

4. Cashier clicks "Proceed to Payment"
   ↓ handleProceedToPayment()
   ↓ Negative stock check (if !allowNegativeStock): compare cart qty vs product.stock / variation.current_stock
   ↓ Builds saleData with isPOS: true, status: 'final', paymentStatus: 'unpaid', paid: 0, due: total
   ↓ createSale(saleData) in SalesContext
       → SalesContext detects isPOS → docType = 'pos' → sequenceType = 'PS'
       → documentNumberService.getNextDocumentNumberGlobal(companyId, 'PS') → invoice number
       → saleService.createSale() writes sales + sales_items rows
       → postSaleDocumentAccounting(sale.id) fires asynchronously (non-blocking)
   ↓ Returns { id, invoiceNo }
   ↓ Opens UnifiedPaymentDialog (paymentDialogOpen = true)

5. Cashier records payment in UnifiedPaymentDialog
   ↓ Payment method: Cash / Card / split
   ↓ Creates payments row via saleService payment path
   ↓ Updates sales.payment_status → 'paid' or 'partial'

6. onPaymentSuccess()
   ↓ setPendingSelectSaleId(newSale.id)
   ↓ refreshSales() — reloads sales list
   ↓ clearCart()
   ↓ Once posSalesList refreshes, pendingSelectSaleId effect fires → setSelectedSaleIndex(idx) to view new sale
```

---

## Walk-in Customer Handling

The POS initialises `selectedCustomer = "walk-in"` and always includes a sentinel `{ id: "walk-in", name: "Walk-in Customer" }` as the first entry in the customers array (independent of the DB contact list).

At checkout in `handleProceedToPayment()`:
```typescript
const customerId = selectedCustomer === 'walk-in' ? null : selectedCustomer;
const customerName = selectedCustomerData?.name || 'Walk-in Customer';
```

- `sales.customer` (the customer UUID FK) is set to `null` for walk-in.
- `sales.customer_name` is set to `'Walk-in Customer'`.
- In the edit flow (`handleSavePosEdit`), the same logic applies: `customer: selectedCustomer === 'walk-in' ? '' : selectedCustomer`.

Registered customers are loaded from `contactService.getAllContacts(companyId)` filtered to `type === 'customer' && is_active`.

---

## Payment Processing

Payment is collected through `UnifiedPaymentDialog` after the sale row is created. The POS does not have its own payment modal.

| Method | How handled |
|--------|-------------|
| Cash | Standard payment method; `payment_method = 'Cash'` on sale row |
| Card | `payment_method = 'Card'` |
| Split payment | `UnifiedPaymentDialog` supports split amounts; multiple payment rows created |

The `editPaymentMethod` state in POS edit mode (`'Cash' | 'Card'`) is used when the cashier edits an existing POS sale inline — the updated method is written directly to the sale row via `updateSale()`.

The POS does not implement its own payment dialog logic. All payment persistence and JE creation delegates to the shared `UnifiedPaymentDialog` → `saleService` path.

---

## Stock Effect

The POS sale uses the exact same stock movement path as a regular final sale:

- `saleService.createSale()` inserts negative `stock_movements` rows (one per line item / variation).
- `calculateStockFromMovements()` is used in POS to compute the branch-scoped stock overlay when `branchId` is set.
- The branch overlay is loaded from `stock_movements` at POS open and applied to `products` state; it does not update in real time after checkout — cashier must reload POS to see updated branch stock.
- Negative stock is blocked by `settingsService.getAllowNegativeStock(companyId)`. This is read from the DB (single source of truth for all users/sessions), not from context state.

---

## Accounting Effect

Same JE as a regular finalised sale, posted by `postSaleDocumentAccounting(sale.id)`:

```
Dr  Accounts Receivable (1100)   sale.total
Cr  Revenue / Sales account       sale.total

— when payment is recorded —
Dr  Cash (1000) or Bank (1010)   payment.amount
Cr  Accounts Receivable (1100)   payment.amount

journal_entries.reference_type = 'sale'
journal_entries.reference_id   = sales.id
```

The POS JE is **not** fired synchronously. `postSaleDocumentAccounting()` is called with `.catch(warn)` — if it fails, the sale is created but the GL is not updated and no user-visible error is shown.

---

## POS vs Regular Sale (Differences and Shared Paths)

| Concern | POS | Regular Sale |
|---------|-----|-------------|
| Document number prefix | `PS-NNNN` (via `getNextDocumentNumberGlobal(companyId, 'PS')`) | `SL-NNNN` (`'SL'`), `SDR-NNNN`, `SQT-NNNN`, etc. |
| `isPOS` flag on payload | `true` | `false` / absent |
| Lifecycle stages | None — always `status: 'final'` on creation | draft → quotation → order → final |
| Customer | Walk-in sentinel or registered contact | Registered contact required for credit sales |
| Payment flow | Immediate: sale created unpaid, then `UnifiedPaymentDialog` opens | Same (for counter sales); deferred for credit |
| Stock movement | Same (`sales_items` → `stock_movements`) | Same |
| JE / accounting | Same (`postSaleDocumentAccounting`) | Same |
| Return / void | Via regular Sales Return flow (not inline POS) | Same return flow |
| Edit | Inline `handleSavePosEdit()` — cart refilled from existing sale via `enterEditMode()` | Standard sale edit drawer |
| Sales table | Same `sales` table | Same `sales` table |
| Commission | `salesmanId` set; `commission_status = 'pending'` | Same |

The key difference is **only** the document number prefix and the absence of pre-invoice lifecycle stages.

---

## Offline / Fallback Considerations

The POS has no offline mode. All operations require a live Supabase connection:

- Product and customer lists are loaded on mount; no local cache beyond React state.
- `getNextDocumentNumberGlobal()` calls a Supabase RPC — if the DB is unreachable, the sale cannot be created.
- The branch stock overlay has a `try/catch` with `console.warn` fallback — if `stock_movements` query fails, the product's base stock field is used without branch adjustment.
- `today's stats` reload silently fails to `{ total: 0, count: 0 }` on error.

There is no IndexedDB, Service Worker, or queued operation mechanism. Network loss during checkout will cause `createSale()` to throw and the cart will not be cleared.

---

## Known Failure Points

1. **`postSaleDocumentAccounting` is fire-and-forget.** POS sale is saved but the GL entry may silently fail. The cashier sees a success toast, the accountant sees a missing JE. No retry mechanism exists.

2. **Branch required at checkout** — `handleProceedToPayment()` checks `!branchId || branchId === 'all'` and blocks with a toast error. If the user has not selected a branch (multi-branch company), POS is unusable. No automatic branch detection.

3. **Branch stock overlay is stale** — after each checkout the stock displayed in the product grid is not decremented until `loadData()` is called again (e.g. page reload or explicit refresh). A cashier who sells item X twice in quick succession may not see the updated stock warning on the second sale.

4. **Duplicate sale guard via `posSaveInProgressRef`** — the guard is component-local. A fast double-tap on a slow connection can still create two sales if the first `createSale` network call has not resolved before the second tap.

5. **POS edit does not re-fire the JE** — `handleSavePosEdit()` calls `updateSale()` which re-runs `postSaleDocumentAccounting`. If the original JE exists and a reversal is not performed first, the ledger may contain both the original and the revised JE simultaneously.

6. **No POS-specific receipt printing** — `UnifiedPaymentDialog` handles payment but thermal receipt printing must be configured separately; there is no built-in thermal receipt flow gated by `posSettings`.

7. **Walk-in sales with `customer = null`** — downstream ledger reports that join `sales → contacts` will produce orphaned rows for all walk-in POS sales. AR aging and customer ledger views must handle `customer_id IS NULL` explicitly.

---

## Recommended Standard

1. **Make `postSaleDocumentAccounting` observable.** Log failures to a `posting_errors` table or Supabase edge function queue so accounting can detect and retry missing JEs without manual reconciliation.

2. **Atomic invoice number + sale creation.** Wrap `getNextDocumentNumberGlobal()` and `saleService.createSale()` in a single Supabase RPC to prevent orphaned sequence increments when the sale insert fails after the number is consumed.

3. **Real-time stock decrement after checkout.** After `onPaymentSuccess()`, call `loadData()` or update the specific product's stock in state to reflect the sale's stock movement immediately.

4. **Enforce branch selection at POS launch**, not at checkout. Show a branch picker modal before the POS terminal renders, so the cashier never reaches the checkout block.

5. **Idempotent POS edit JE.** `handleSavePosEdit()` must void the existing JE before updating the sale, then trigger a fresh `postSaleDocumentAccounting()` — matching the pattern used in expense edit (`classifyPaidExpenseEdit` → void → repost).
