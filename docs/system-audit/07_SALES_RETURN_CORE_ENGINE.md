# 07 — Sales Return Core Engine

**Last updated:** 2026-04-12
**Stack:** Next.js + Supabase (multi-tenant)
**Scope:** Full sale return lifecycle — create, finalize, void, restore; linked and standalone modes

---

## Business Purpose

The Sales Return module reverses the financial and inventory effects of a completed sale, either fully or partially. It supports two modes: a **linked return** (against a specific original invoice) and a **standalone return** (no invoice reference, e.g. exchange counter, walk-in refund). A finalized return credits the customer's AR or issues a cash/bank refund, restores inventory stock, and reverses the COGS journal entry. The return sub-system shares the same double-entry accounting framework as sales, with its own idempotency fingerprints and void/restore cycle.

---

## UI Entry Points

| Entry Point | Description |
|---|---|
| Sales Returns list page | `/sales/returns` — lists all `sale_returns` for the active branch |
| Add Return (from Sale Detail) | `ViewSaleDetailsDrawer` → "Return" button; pre-populates with original sale items and proportional discount |
| Add Standalone Return | Direct form without original sale reference |
| Edit Return | Draft returns only; opens `SaleReturnForm` in edit mode |
| Void Return | Action on a final return; triggers `voidSaleReturn()` |

---

## Frontend Files

### `SaleReturnForm.tsx`
`/Users/ndm/Documents/Development/CursorDev/NEWPOSV3/src/app/components/sales/SaleReturnForm.tsx`

- Renders the return form for both linked and standalone modes.
- For linked returns: pre-loads original sale items via `saleReturnService.getOriginalSaleItems()`, shows `already_returned` quantities, enforces `max_returnable = original_qty - already_returned`.
- **Discount propagation (FIXED):** A `useEffect` watches `returnSubtotal` and recalculates `discountAmount` proportionally from the original sale:
  ```
  returnDiscount = originalSale.discount_amount × (returnSubtotal / originalSale.subtotal)
  ```
  This ensures partial returns carry a fair share of the original discount, not zero.
- Refund method selector: Cash, Bank, AR Credit (links to `refund_account_id`).
- Packing detail fields for fabric/textile returns (box/piece level).
- On submit: calls `saleReturnService.createSaleReturn()` then `saleReturnService.finalizeSaleReturn()`.

---

## Backend Services

### `saleReturnService.ts` — Key Functions

| Function | Description |
|---|---|
| `createSaleReturn(data)` | Inserts `sale_returns` header (status='draft') + `sale_return_items`. Generates `return_no`. Accepts optional `subtotal`, `discount_amount`, `total` from caller (else calculates from items). |
| `updateSaleReturn(returnId, companyId, data)` | Updates a draft return only. Replaces all items (delete-then-insert). Blocked on `final` and `void`. |
| `finalizeSaleReturn(returnId, companyId, branchId, userId?)` | Main finalization function. See Finalize Flow below. |
| `voidSaleReturn(returnId, companyId, branchId?, userId?)` | Voids a final return. See Void Flow below. Idempotent — returns `{ alreadyVoided: true }` if already void. |
| `restoreVoidedSaleReturnToFinal(returnId, companyId)` | Advanced ops: undoes a void. Soft-voids reversal JEs, deletes `sale_return_void` stock rows, restores status to `final`. |
| `restoreLatestVoidedSaleReturnToFinal(companyId, branchId?)` | Convenience wrapper: finds the most recently voided return and restores it. |
| `getSaleReturnById(returnId, companyId)` | Fetches return with items. |
| `getSaleReturns(companyId, branchId?)` | Lists all returns for company, ordered by `return_date` desc. |
| `getOriginalSaleItems(saleId, companyId)` | Fetches original sale line items enriched with `already_returned` quantities (from `final` returns only). Used to populate the return form. |
| `generateReturnNumber(companyId, branchId)` | Generates the `return_no` sequence. |
| `canonicalSaleReturnStockEconomics(returnItem, originalLine?)` | Pure function. Computes `{ qty, unitCost, totalCost }` for a return line. Linked: proportional to original line total `(returnQty / originalQty) × originalLineTotal`. Standalone: uses `unit_price` / `total` directly. |
| `matchOriginalSaleLineForReturnItem(returnItem, originalItems)` | Matches a return item to its original sale line by `sale_item_id` (primary) or `product_id + variation_id` (fallback). |

### `saleAccountingService.ts` — Return-Specific Functions

| Function | Description |
|---|---|
| `createSaleReturnInventoryReversalJE(params)` | Posts the inventory reversal JE: Dr Inventory (1200) / Cr COGS (5000). Idempotent via fingerprint `sale_return_cogs:<companyId>:<returnId>`. Called from `finalizeSaleReturn`. |
| `AccountingContext.recordSaleReturn()` | Posts the settlement JE: Dr Sales Revenue (4100) / Cr Cash\|Bank\|AR. Called from the UI after `finalizeSaleReturn`. Fingerprint: `sale_return_settlement:<companyId>:<returnId>`. |

---

## DB Tables

| Table | Role |
|---|---|
| `sale_returns` | Return header: `original_sale_id` (nullable), status, subtotal, discount_amount, tax_amount, total, return_no, refund_method, refund_account_id |
| `sale_return_items` | Return line items: `sale_item_id` (FK to original line), product_id, variation_id, quantity, unit_price, total, packing fields |
| `stock_movements` | `movement_type='sale_return'` for finalize; `movement_type='sale_return_void'` for void |
| `journal_entries` | Both JEs tagged `reference_type='sale_return'` |
| `journal_entry_lines` | Debit/credit lines for both settlement and inventory JEs |
| `sales` | Original sale (for linked returns: status validation, item fetch) |
| `sales_items` / `sale_items` | Original sale lines (canonical / legacy fallback) |

---

## Linked Return Create Flow

```
1. UI loads original sale via getOriginalSaleItems(saleId, companyId)
   → items include already_returned qty (filtered to final returns only)
   → user selects quantities ≤ (original_qty - already_returned)
2. UI computes returnSubtotal from selected items
3. Discount useEffect: returnDiscount = origSale.discount_amount × (returnSubtotal / origSale.subtotal)
4. saleReturnService.createSaleReturn(data):
   a. Calculate subtotal/total from items (or use caller-provided values)
   b. Generate return_no
   c. INSERT sale_returns with status='draft', original_sale_id set
   d. INSERT sale_return_items (preserving packing structure from original)
5. saleReturnService.finalizeSaleReturn() called immediately after create
   (see Finalize Flow)
```

---

## Standalone Return Create Flow

```
1. UI renders SaleReturnForm without a preloaded original sale
2. User manually enters items, quantities, unit prices
3. No discount propagation (no original sale to reference)
4. No quantity validation (no original to compare against)
5. saleReturnService.createSaleReturn(data):
   a. original_sale_id = null
   b. INSERT sale_returns with status='draft'
   c. INSERT sale_return_items
6. saleReturnService.finalizeSaleReturn() — isStandalone=true path
   (stock economics use unit_price directly; no qty validation)
```

---

## Finalize Flow

`finalizeSaleReturn(returnId, companyId, branchId, userId?)`:

```
1. Fetch sale_return with items
   - Guard: if already 'final' → return (idempotent)
   - Guard: if 'void' → throw
   - Guard: status must be 'draft'

2. If linked (original_sale_id set):
   a. Fetch original sale (validate: not draft/quotation)
   b. Fetch original sale items (sales_items → sale_items fallback)
   c. Fetch FINAL return IDs only for this sale (excludes drafts — QTY VALIDATION FIX)
   d. For each return item:
      - Find matching original item by sale_item_id or product_id+variation_id
      - Count alreadyReturned from sale_return_items IN (finalReturnIds only)
      - Throw if (alreadyReturned + returnQty) > originalQty

3. Claim final status atomically:
   UPDATE sale_returns SET status='final' WHERE id=returnId AND status='draft'
   → If claimedFinal is null: check current status (race condition guard)

4. Rollback function defined: sets status back to 'draft' on any subsequent error

5. Compute totalInventoryCostForJE:
   For each return item: canonicalSaleReturnStockEconomics(item, originalLine)
   totalInventoryCostForJE += econ.totalCost

6. Align sale_return_items $ with canonical economics:
   For each item: if stored unit_price or total differ from canonical → UPDATE sale_return_items

7. Create stock movements (movement_type='sale_return', positive qty = stock IN):
   For each item:
   - saleReturnHasStockLine() idempotency guard
   - canonicalSaleReturnStockEconomics() for qty/unit_cost/total_cost
   - productService.createStockMovement()
   - Packing box/piece changes computed proportionally from original

8. Recalculate sale_returns.subtotal and total from line sum + discount

9. If linked: recalc_sale_payment_totals(original_sale_id) — updates original sale's due_amount

10. Post inventory reversal JE (non-blocking):
    saleAccountingService.createSaleReturnInventoryReversalJE():
      Dr Inventory (1200) = totalInventoryCostForJE
      Cr COGS (5000)      = totalInventoryCostForJE
      fingerprint: 'sale_return_cogs:<companyId>:<returnId>'

11. [Separate UI call] AccountingContext.recordSaleReturn():
    Settlement JE:
      Dr Sales Revenue (4100)  = return.total (net after discount)
      Cr Cash (1000) | Bank (1010) | AR subledger  [by refund_method]
      fingerprint: 'sale_return_settlement:<companyId>:<returnId>'

12. Dispatch ledgerUpdated event for customer balance refresh

On any error after step 3: rollbackToDraft() restores status='draft'
```

---

## Discount Propagation

### The Bug (FIXED)

`SaleReturnForm` previously initialized `discountAmount = 0` without any link to the original sale's discount. When a customer returned goods from a discounted invoice, the return total was calculated on the gross item price, giving the customer full item price credit even though they originally paid a discounted amount.

### The Fix

A `useEffect` in `SaleReturnForm.tsx` watches `returnSubtotal` (recalculated whenever return items change) and sets:

```typescript
const returnDiscount = originalSale.discount_amount * (returnSubtotal / originalSale.subtotal);
setDiscountAmount(roundMoney2(returnDiscount));
```

This proportionally distributes the original sale's discount across the partial return, so the settlement JE credits only `return.total` (net), not the gross item price.

**Key invariant:** The settlement JE amount is always `return.total` — which is `subtotal - discount_amount + tax_amount`. Discount propagation ensures this reflects the correct economic value being reversed.

---

## Quantity Validation

### The Bug (FIXED)

`finalizeSaleReturn` previously fetched already-returned quantities without filtering by status:

```typescript
// OLD (broken): counted drafts
const { data: existingReturns } = await supabase
  .from('sale_return_items')
  .select('quantity')
  .eq('sale_item_id', returnItem.sale_item_id);
  // No status filter → draft returns inflated alreadyReturned count
```

If a user created a draft return (but did not finalize it), a second return attempt for the same item would count the abandoned draft's quantity and incorrectly throw:
`"Return quantity (N) exceeds original quantity (M) for [product]"`

### The Fix

A two-step approach was implemented:

```typescript
// Step 1: Pre-fetch IDs of FINAL returns only
const { data: finalReturnsForSale } = await supabase
  .from('sale_returns')
  .select('id')
  .eq('original_sale_id', saleReturn.original_sale_id)
  .eq('company_id', companyId)
  .eq('status', 'final');  // Only final returns count

const finalReturnIds = finalReturnsForSale.map(r => r.id);
// Sentinel UUID used when list is empty (avoids PostgREST .in([]) syntax error)

// Step 2: Count quantities only within final return items
const { data: existingReturns } = await supabase
  .from('sale_return_items')
  .select('quantity')
  .eq('sale_item_id', returnItem.sale_item_id)
  .in('sale_return_id', finalReturnIdsOrSentinel);
```

This mirrors the logic in `getOriginalSaleItems()` which also filters by `status='final'` when computing `already_returned`.

---

## Void Flow

`voidSaleReturn(returnId, companyId, branchId?, userId?)`:

```
1. Fetch sale_return with items
   - Guard: if already 'void' → return { alreadyVoided: true }
   - Guard: status must be 'final'

2. Fetch original sale items (if linked) for canonical economics

3. Claim void atomically:
   UPDATE sale_returns SET status='void' WHERE id=returnId AND status='final'
   → Race condition: if null → check current status

4. Rollback function: sets status back to 'final' on error

5. Reverse all active sale_return JEs:
   Fetch all journal_entries WHERE reference_type='sale_return' AND reference_id=returnId AND not voided
   For each JE: accountingService.createReversalEntry() with bypassJournalSourceControlPolicy=true
   → Posts correction_reversal JEs (both settlement + inventory JEs reversed)

6. Create NEGATIVE stock movements (movement_type='sale_return_void'):
   For each item:
   - saleReturnHasStockLine() idempotency guard
   - canonicalSaleReturnStockEconomics() for economics
   - productService.createStockMovement() with negative quantity (stock OUT)
   - Packing changes are negative (boxes/pieces leave)

7. If linked: recalc_sale_payment_totals(original_sale_id)

8. Dispatch ledgerUpdated for customer balance refresh

On any error: rollbackToFinal()
```

**Restore from void** (`restoreVoidedSaleReturnToFinal`): soft-voids all `correction_reversal` JEs, deletes `sale_return_void` stock rows, sets status back to `final`.

---

## Stock Effect

| Event | `movement_type` | `quantity` | `total_cost` | `reference_type` |
|---|---|---|---|---|
| Return finalized | `sale_return` | positive (stock IN) | positive (canonical cost) | `sale_return` |
| Return voided | `sale_return_void` | negative (stock OUT) | positive (canonical cost) | `sale_return` |

**Canonical stock economics:**
- Linked return: `totalCost = (returnQty / originalQty) × originalLineTotal`
  - Full-line return: uses exact original line total (no rounding drift)
  - Partial return: proportional fraction
- Standalone: `totalCost = qty × unit_price` (or from stored `total` field)
- `unit_cost = totalCost / qty`
- All values rounded to 2 decimal places via `roundMoney2()`

Sale return items are patched to align with canonical economics during finalization (before stock movements are written) to ensure GL and stock agree.

---

## Accounting Effect

### Two JEs per finalized return

**JE 1: Settlement (posted by `AccountingContext.recordSaleReturn()`)**
```
Dr Sales Revenue (4100)                              = return.total (NET after discount)
   Cr Cash (1000) | Bank (1010) | AR subledger       = return.total  [by refund_method]
```
- `reference_type = 'sale_return'`, `reference_id = returnId`
- `action_fingerprint = 'sale_return_settlement:<companyId>:<returnId>'`

**JE 2: Inventory Reversal (posted by `saleAccountingService.createSaleReturnInventoryReversalJE()`)**
```
Dr Inventory (1200)                                  = totalInventoryCostForJE
   Cr Cost of Production / COGS (5000)               = totalInventoryCostForJE
```
- `reference_type = 'sale_return'`, `reference_id = returnId`
- `action_fingerprint = 'sale_return_cogs:<companyId>:<returnId>'`

Both JEs share `reference_type='sale_return'` so `voidSaleReturn` can find and reverse them automatically via `createReversalEntry`.

### On Void — Correction Reversal JEs
`accountingService.createReversalEntry()` with `bypassJournalSourceControlPolicy=true` creates `correction_reversal` JEs for each active `sale_return` JE. These are tagged `reference_type='correction_reversal'`, `reference_id=<original_je_id>`.

---

## Party Balance Effect

- If `refund_method` routes to AR (credit note): the settlement JE Dr Sales Revenue / Cr AR subledger reduces the customer's outstanding receivable.
- If refund is Cash or Bank: the settlement JE Dr Sales Revenue / Cr Cash|Bank — no AR balance change; customer receives physical refund.
- `dispatchContactBalancesRefresh(companyId)` fires after finalize and void to update real-time balance displays.

---

## Source of Truth

| Data Point | Source |
|---|---|
| Return total | `sale_returns.total` (recalculated from line sum - discount + tax on finalize) |
| Inventory restored | `stock_movements` (movement_type='sale_return') |
| Settlement JE | `journal_entries` with fingerprint `sale_return_settlement:*` |
| COGS reversal JE | `journal_entries` with fingerprint `sale_return_cogs:*` |
| Already returned qty | `sale_return_items` filtered to `status='final'` returns only |
| Original sale impact | `sales.due_amount` updated via `recalc_sale_payment_totals` RPC |

---

## Known Bug History

### BUG-1: Discount Propagation (FIXED)

**Component:** `SaleReturnForm.tsx`
**Symptom:** Return total was always computed on gross item price regardless of original sale discount. Customer received more credit than they were entitled to.
**Root cause:** `discountAmount` state initialized to `0` with no `useEffect` to propagate from original sale.
**Fix:** Added `useEffect` watching `returnSubtotal`:
```typescript
returnDiscount = originalSale.discount_amount × (returnSubtotal / originalSale.subtotal)
```
**Impact:** Linked returns only. Standalone returns are unaffected (no original sale to propagate from).

---

### BUG-2: Quantity Validation Draft Pollution (FIXED)

**Component:** `saleReturnService.ts` → `finalizeSaleReturn()`
**Symptom:** "Return quantity exceeds original quantity" error thrown when a previous draft return existed for the same items, even though the draft was never finalized and had no financial impact.
**Root cause:** `alreadyReturned` was computed from all `sale_return_items` without filtering by parent `sale_return.status`, so abandoned drafts inflated the count.
**Fix:**
1. Pre-fetch `finalReturnIds` for the sale (status='final' only)
2. Use `.in('sale_return_id', finalReturnIds)` when counting existing return quantities
3. Use sentinel UUID `'00000000-0000-0000-0000-000000000000'` when `finalReturnIds` is empty to avoid PostgREST `.in([])` parse error
**Impact:** Linked returns only. Standalone returns have no quantity validation.

---

## Recommended Standard

1. **Always call `finalizeSaleReturn` after `createSaleReturn`.** The system creates returns in `draft` status first. A draft return has no financial or stock effect. If the process is interrupted between create and finalize, the draft must be either finalized or deleted — it cannot be left open indefinitely as it will not affect inventory or accounting but may confuse list views.

2. **Do not count draft returns when computing remaining returnable qty in any external query.** Any report or UI component that computes `returnableQty = originalQty - alreadyReturned` must filter `sale_returns.status = 'final'` before joining to `sale_return_items`.

3. **Settlement JE amount must always equal `return.total` (NET).** The discount was already applied during finalization's subtotal recalculation. Never post the settlement JE against gross subtotal.

4. **Standalone returns bypass qty validation.** This is by design — there is no original sale to validate against. Ensure the business process for standalone returns includes manual verification before finalizing.

5. **Void is the correct reversal mechanism for final returns.** Do not attempt to hard-delete a final return. Use `voidSaleReturn()` to create a complete reversal audit trail. Reserve `restoreVoidedSaleReturnToFinal` for operator corrections (e.g. voided by mistake).

6. **Both JEs must use `reference_type='sale_return'`.** The settlement JE (called from UI) and the inventory JE (called from finalize) must both tag `reference_type='sale_return'` and `reference_id=returnId`. This is required for `voidSaleReturn`'s JE discovery query to find and reverse both in one pass.

7. **`sale_item_id` FK points to `sale_items` only.** The `sale_return_items.sale_item_id` foreign key was defined against the legacy `sale_items` table. When original items come from the canonical `sales_items` table, `sale_item_id` must be set to `null` to avoid FK violation — matching then falls back to `product_id + variation_id`. This is a known schema debt that must be resolved when `sale_items` is deprecated.
