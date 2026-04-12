# 09 — Purchase Return Core Engine

**Last updated:** 2026-04-12
**Status:** Production — multi-tenant, branch-aware.

---

## Business Purpose

Records returns of purchased goods back to a supplier. Reduces inventory (stock out) and credits the supplier's AP subledger (reduces the amount owed to the supplier). Supports two modes: linked returns (against a specific original purchase invoice) and standalone returns (no original purchase). Linked returns enforce per-product over-return validation.

---

## UI Entry Points

| Surface | Route / Drawer | Purpose |
|---|---|---|
| Purchase Return Form | `PurchaseReturnForm` (drawer or page) | Create a new return — search original purchase, select items and quantities |
| View Purchase Details | `ViewPurchaseDetailsDrawer` | Displays return history for a purchase; return count drives the edit lock on the parent purchase |
| Purchase Returns List | `view: purchase-returns` (if present) | List all returns with status, link to original PO |

---

## Frontend Files

| File | Role |
|---|---|
| `src/app/purchases/PurchaseReturnForm.tsx` (or equivalent) | Form: select original purchase → populate items with `already_returned` qty → select return quantities |
| `src/app/purchases/ViewPurchaseDetailsDrawer.tsx` | Shows linked returns; drives `hasReturn` lock indicator |
| `src/app/context/PurchaseContext.tsx` | Exposes return-related helpers if any; `hasReturn` populated on purchase load |

---

## Backend Services

| Service | File | Role |
|---|---|---|
| `purchaseReturnService` | `src/app/services/purchaseReturnService.ts` | All CRUD and lifecycle for purchase returns |
| `productService` | `src/app/services/productService.ts` | `createStockMovement` — called inside `finalizePurchaseReturn` and `voidPurchaseReturn` |
| `accountingService` | `src/app/services/accountingService.ts` | `createReversalEntry` — called inside `voidPurchaseReturn` |

Note: `purchaseReturnService` does **not** call `purchaseAccountingService` directly for the finalize JE. Accounting for the return document (Dr AP / Cr Inventory) is expected to be posted by a calling layer or a separate trigger. The finalize method currently posts only stock movements and triggers `ledgerUpdated` / `recalc_purchase_payment_totals`. See Known Failure Points.

---

## DB Tables

| Table | Key Columns | Notes |
|---|---|---|
| `purchase_returns` | `id, company_id, branch_id, original_purchase_id, return_no, return_date, supplier_id, supplier_name, status, subtotal, discount_amount, tax_amount, total, reason, notes, created_by` | `original_purchase_id` nullable — null = standalone return |
| `purchase_return_items` | `id, purchase_return_id, purchase_item_id, product_id, variation_id, product_name, sku, quantity, unit, unit_price, total, packing_type, packing_quantity, packing_unit, packing_details, return_packing_details` | `return_packing_details` JSONB: `{returned_pieces, returned_boxes, returned_pieces_count, returned_total_meters}` |
| `stock_movements` | `id, company_id, branch_id, product_id, variation_id, movement_type, quantity, unit_cost, total_cost, reference_type, reference_id, box_change, piece_change` | `reference_type='purchase_return'`; finalize writes `movement_type='purchase_return'`; void writes `movement_type='purchase_return_void'` |
| `journal_entries` | `id, reference_type, reference_id, is_void, payment_id` | Void flow queries `reference_type='purchase_return'` for reversal |
| `document_sequences` | `company_id, branch_id, document_type='purchase_return', prefix, current_number, padding` | Number source for `return_no`; falls back to `PRET-YYYYMMDD-XXXX` |
| `purchases` | see 08_PURCHASE_CORE_ENGINE | Parent purchase; `hasReturn` derived from `purchase_returns` count |

---

## Create Flow (Linked to Original Purchase)

Entry point: `purchaseReturnService.createPurchaseReturn(data)`.

1. **Totals calculation**:
   - `subtotal` = sum of `item.total` across all items (if `providedSubtotal` not given).
   - `discount_amount` = 0 (if `providedDiscount` not given).
   - `tax_amount` = 0 (hardcoded — no tax on returns currently).
   - `total` = `subtotal - discount_amount + tax_amount`.

2. **Return number** — `generateReturnNumber(companyId, branchId)`:
   - Queries `document_sequences` for `document_type='purchase_return'`.
   - If found: increments `current_number`, returns `{prefix}{padded}`.
   - If not found: returns `PRET-{YYYYMMDD}-{last4 of timestamp}`.

3. **Insert `purchase_returns`** with `status='draft'`.

4. **Insert `purchase_return_items`** — preserves all packing fields (`packing_type`, `packing_quantity`, `packing_unit`, `packing_details`) from the original purchase item. Also stores `return_packing_details` for piece-level return tracking.

5. **Browser event**: `window.dispatchEvent(new CustomEvent('purchaseReturnsChanged'))`.

**Standalone return** (`original_purchase_id = null`): same flow, no link to a parent purchase.

---

## Finalize Flow (Stock Reversal, JE Reversal)

Entry point: `purchaseReturnService.finalizePurchaseReturn(returnId, companyId, branchId, userId?)`.

### Pre-finalize guards

1. `status` must be `'draft'`. Already-`'final'` → returns silently (idempotent). `'void'` → throws.
2. For linked returns: loads original purchase. Original must have `status = 'final'` or `'received'`; otherwise throws.
3. **Over-return validation** (linked returns only):
   - For each return item, finds the matching `purchase_items` row by `(product_id, variation_id)`.
   - Queries `purchase_return_items` for all OTHER returns against the same `original_purchase_id` (excluding current return `purchase_return_id`).
   - Note: queries ALL statuses from `purchase_return_items` — **not filtered by `status='final'`**. Draft return quantities are counted against the limit. See Known Failure Points.
   - `alreadyReturned + retItem.quantity > orig.quantity` → throws "Return qty exceeds purchased qty".

### Status claim (optimistic concurrency)

```
UPDATE purchase_returns
SET status = 'final', updated_at = now()
WHERE id = returnId AND company_id = companyId AND status = 'draft'
RETURNING id
```
If no row returned: re-checks current status. If already `'final'`, returns silently. Otherwise throws concurrent update error.

**Rollback function** defined: `rollbackPurchaseDraft()` — sets status back to `'draft'` if subsequent steps throw.

### Stock movements (inside finalize try block)

For each `purchase_return_items` row:

1. **Packing calculation**:
   - Linked: calculates `boxChange` and `pieceChange` proportionally from original purchase item packing (`returnQty / origQty * original_boxes`).
   - Standalone: reads `packing_details` directly from the return item.

2. **Idempotency check**: `purchaseReturnHasStockLine(companyId, returnId, 'purchase_return', productId, variationId)` — queries `stock_movements` for an existing row. If found, skips this item.

3. **Insert stock movement** via `productService.createStockMovement`:
   - `movement_type: 'purchase_return'`
   - `quantity: -Number(item.quantity)` (**negative** — stock OUT)
   - `unit_cost: item.unit_price`
   - `total_cost: item.total` (purchase price, positive amount stored even though quantity is negative)
   - `reference_type: 'purchase_return'`
   - `reference_id: returnId`
   - `box_change: -boxChange` (if > 0)
   - `piece_change: -pieceChange` (if > 0)

### Post-finalize side effects

- `window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'supplier', entityId: supplierId } }))` — triggers supplier ledger refresh.
- `supabase.rpc('recalc_purchase_payment_totals', { p_purchase_id: original_purchase_id })` — recalculates `paid_amount`, `due_amount`, `payment_status` on the parent `purchases` row (if linked).
- `window.dispatchEvent(new CustomEvent('purchaseReturnsChanged'))`.

### Accounting JE on finalize

**There is no JE created inside `finalizePurchaseReturn`.** The service only writes stock movements and triggers balance recalculation. Any JE for the return document (Dr AP / Cr Inventory) must be posted by the calling context or a separate accounting layer. This is a gap versus the sale return engine — see Known Failure Points.

---

## Quantity Validation (Over-Return Risk)

`finalizePurchaseReturn` queries `purchase_return_items` without filtering on `status`:

```ts
const { data: existingReturns } = await supabase
  .from('purchase_return_items')
  .select('quantity')
  .eq('product_id', retItem.product_id)
  .is('variation_id', retItem.variation_id || null)
  .neq('purchase_return_id', returnId);  // excludes current return only
// No .eq('status', 'final') filter on purchase_returns
```

This means draft returns (not yet finalized, or even abandoned drafts) count against the returnable quantity. A product with `orig_qty=10`, one draft return of `qty=8` (never finalized), and a new return of `qty=4` will be blocked with "Return qty exceeds purchased qty" even though the draft has no stock effect.

The `getOriginalPurchaseItems` helper (used by the form to show `already_returned`) **does** filter on `status='final'`, so the UI shows a higher available quantity than the backend will allow. This mismatch can cause confusing validation errors on finalize.

---

## Void Flow

Entry point: `purchaseReturnService.voidPurchaseReturn(returnId, companyId, branchId?, userId?)`.

**Guards:**
- `status = 'void'` → returns `{ alreadyVoided: true }` immediately (idempotent).
- `status !== 'final'` → throws "Only finalized purchase returns can be voided."

**Status claim:**
```
UPDATE purchase_returns
SET status = 'void', updated_at = now()
WHERE id = returnId AND company_id = companyId AND status = 'final'
RETURNING id, supplier_id, original_purchase_id
```
If no row returned: re-checks; already void → `{ alreadyVoided: true }`. Otherwise throws.

**Rollback function** defined: `rollbackPurchaseFinal()` — sets status back to `'final'` if subsequent steps throw.

### JE reversal

Queries all non-void `journal_entries` where `reference_type='purchase_return'` and `reference_id=returnId`. For each:
- Calls `accountingService.createReversalEntry(companyId, branchForJe, jeId, userId, reason, { bypassJournalSourceControlPolicy: true })`.
- `reason`: `"Void purchase return {return_no}"`.
- Failure per JE is warned and skipped (non-fatal).

### Stock reversal on void

For each `purchase_return_items` row:

1. **Packing calculation**: same proportional or direct logic as finalize.
2. **Idempotency check**: `purchaseReturnHasStockLine(companyId, returnId, 'purchase_return_void', productId, variationId)`.
3. **Insert stock movement**:
   - `movement_type: 'purchase_return_void'`
   - `quantity: +Number(item.quantity)` (**positive** — stock back IN)
   - `reference_type: 'purchase_return'`, `reference_id: returnId`
   - `box_change: +boxChange`, `piece_change: +pieceChange`

Post-void: fires `ledgerUpdated`, calls `recalc_purchase_payment_totals`, fires `purchaseReturnsChanged`.

### Restore void to draft

Entry point: `purchaseReturnService.restoreVoidedPurchaseReturnToDraft(returnId, companyId)`.

- Only callable when `status = 'void'`.
- Deletes ALL `stock_movements` where `reference_id=returnId` and `reference_type='purchase_return'` and `movement_type IN ('purchase_return', 'purchase_return_void')`.
- Sets `status = 'draft'`.
- Does **not** remove posted JEs — a second finalize will create new stock movements. If a JE was posted during the first finalize, the reversal from void remains, and a new JE will be posted on re-finalize.

`restoreLatestVoidedPurchaseReturnToDraft(companyId, branchId?)` — convenience helper that finds the most-recently-updated void return.

---

## Delete Flow

Entry point: `purchaseReturnService.deletePurchaseReturn(returnId, companyId)`.

- **Guard**: if `status = 'final'`, throws "Cannot delete a finalized purchase return."
- Deletes row from `purchase_returns` with `.eq('status', 'draft')` filter (DB-side guard).
- Fires `purchaseReturnsChanged`.
- Only draft returns can be deleted. Final returns must be voided first; voided returns can be restored to draft then deleted, or left as audit records.

---

## Stock Effect Summary

| Event | `movement_type` | `quantity` | `reference_type` | `reference_id` |
|---|---|---|---|---|
| Finalize return | `purchase_return` | -N (negative, stock OUT) | `purchase_return` | return id |
| Void return | `purchase_return_void` | +N (positive, stock IN) | `purchase_return` | return id |

`unit_cost` = `item.unit_price` (purchase price).
`total_cost` = `item.total` (positive value stored regardless of negative quantity direction).

---

## Accounting Effect

### On finalize

No JE is created inside `finalizePurchaseReturn`. The expected JE (not guaranteed to be posted) would be:

```
Dr  AP subledger          = return total
Cr  Inventory (1200)      = return total
```

This mirrors the context description: "supplier ledger CREDIT (reduces payable)" — but the actual debit to AP and credit to Inventory is not wired inside the service. The `ledgerUpdated` event and `recalc_purchase_payment_totals` RPC handle the payment-status side; a separate accounting layer (if wired) must handle the JE.

### On void

`accountingService.createReversalEntry` is called for each existing `purchase_return` JE. The reversal entry mirrors all lines with debits and credits swapped. `bypassJournalSourceControlPolicy: true` is passed to override any journal source restrictions.

---

## Party Balance Effect

- On finalize: `ledgerUpdated` event fired for the supplier. `recalc_purchase_payment_totals` adjusts `purchases.due_amount` (a return reduces what is owed on the linked purchase). Net effect: supplier AP balance decreases.
- On void: same events fired in reverse — balance restored.
- No direct debit to AP subledger GL account from within `purchaseReturnService`; relies on external JE creation (gap) or on the `recalc_purchase_payment_totals` RPC for the payment-status view.

---

## Comparison to Sale Return Engine (Similarities / Differences)

| Aspect | Sale Return (`saleReturnService`) | Purchase Return (`purchaseReturnService`) |
|---|---|---|
| Status lifecycle | `draft → final → void` | `draft → final → void` |
| Finalize guard — original status | Sale must be `final` | Purchase must be `final` or `received` |
| Finalize — stock direction | Negative (stock OUT from customer return IN to warehouse? No — sale return = stock BACK IN) | Negative quantity = stock OUT (goods leave warehouse back to supplier) |
| Stock `movement_type` on finalize | `sale_return` | `purchase_return` |
| Stock `movement_type` on void | (reversal) | `purchase_return_void` |
| Over-return validation | Queries `sale_return_items` without status filter (same risk) | Queries `purchase_return_items` without status filter — **same bug** |
| Accounting JE on finalize | Posted by calling context (same gap pattern) | **Not posted inside service** — same gap |
| Void JE reversal | `accountingService.createReversalEntry` | `accountingService.createReversalEntry` with `bypassJournalSourceControlPolicy: true` |
| Restore to draft | Deletes stock movements, sets `draft` | Deletes stock movements, sets `draft`; preserves JEs |
| Number format | `SRN-` or `SRET-` sequence | `PRET-` sequence |
| Packing support | Depends on sale item packing | Full packing: `packing_details` + `return_packing_details` (piece-level) |
| Parent recalc RPC | `recalc_sale_payment_totals` (if exists) | `recalc_purchase_payment_totals` |
| Standalone mode | Typically linked to sale | Supported: `original_purchase_id = null` |

---

## Known Failure Points

1. **No accounting JE on finalize**: `finalizePurchaseReturn` creates stock movements but does NOT post a JE for Dr AP / Cr Inventory. Unless the calling UI layer or a separate hook posts this JE, the supplier's AP balance in the GL ledger is not updated. The `ledgerUpdated` event and RPC handle payment-status tracking only.

2. **Over-return validation counts draft returns**: `finalizePurchaseReturn` queries `purchase_return_items` without a join to `purchase_returns.status`. Abandoned draft returns permanently block re-returning those quantities, creating a deadlock that requires manual DB intervention.

3. **Form `already_returned` vs. backend validation mismatch**: `getOriginalPurchaseItems` filters by `status='final'`, so the form shows more available quantity than the backend allows. Users can fill in valid quantities that fail on submit with a confusing "Return qty exceeds purchased qty" error.

4. **Void JE reversal is per-existing-JE**: if the finalize step never posted a JE (see point 1), `voidPurchaseReturn` finds no `purchase_return` JEs to reverse. The void succeeds but there is nothing to reverse on the accounting side — the two sides are already balanced at zero.

5. **`restoreVoidedPurchaseReturnToDraft` does not clean up JEs**: if a JE was posted externally on first finalize, and the return is voided (reversal JE created), and then restored to draft, the JE and its reversal remain. A second finalize will post yet another JE, resulting in a doubled accounting effect.

6. **No idempotency on JE in finalize**: since no JE is created in `finalizePurchaseReturn`, there is no fingerprint/idempotency guard. When a calling layer does post a JE, it must implement its own idempotency check.

7. **`tax_amount` is hardcoded to 0**: `const tax_amount = 0`. No path currently applies tax to purchase returns, even if the original purchase had tax. This may understate the return credit on tax-inclusive purchases.

8. **Concurrent finalize race**: same pattern as purchase finalize. The status update uses `eq('status', 'draft')` as an optimistic lock, which prevents double-finalize, but does not prevent duplicate stock movements if the rollback fires after the first movement has already been created and the error occurs on a later item.

9. **`box_change`/`piece_change` rounding**: packing ratios are `Math.round(...)`, so partial box/piece returns may accumulate rounding errors across multiple partial returns against the same purchase.

---

## Recommended Standard

1. **Post the accounting JE inside `finalizePurchaseReturn`**: add a call to `purchaseAccountingService` (or a new `purchaseReturnAccountingService`) immediately after status is claimed and before stock movements. Pattern:
   ```
   Dr  AP subledger (resolvePayablePostingAccountId)  = return total
   Cr  Inventory (1200)                               = return total
   ```
   Use fingerprint: `'purchase_return_document:{companyId}:{returnId}'` for idempotency.

2. **Fix over-return validation to count only `final` returns**: join `purchase_return_items` through `purchase_returns` and filter `purchase_returns.status = 'final'`. Align with `getOriginalPurchaseItems` which already does this correctly.

3. **Add a `canReturn` computed field to `getOriginalPurchaseItems`**: surface `canReturn = orig.quantity - alreadyFinallyReturned` so the form and the backend use the same number.

4. **Guard `restoreVoidedPurchaseReturnToDraft` against re-finalize JE duplication**: either void/remove existing JEs during restore, or implement a fingerprint check so the second finalize's JE is idempotent.

5. **Use RPC or DB trigger for `recalc_purchase_payment_totals`**: trigger it automatically on `purchase_returns` status changes rather than calling it manually from the service.

6. **Add `tax_amount` support**: propagate the original purchase's tax ratio to the return, or allow the form to specify a tax amount on the return.

7. **Log return JE failure**: if the accounting JE post fails, set a flag (`accounting_pending = true`) on the `purchase_returns` row so a reconciliation job can detect and reprocess unposted return JEs.
