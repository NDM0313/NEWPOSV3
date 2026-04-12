# 08 — Purchase Core Engine

**Last updated:** 2026-04-12
**Status:** Production — multi-tenant, branch-aware.

---

## Business Purpose

Records supplier purchases: purchase orders (PO) move from draft → received/final, triggering inventory stock-in and AP accounting. Supports line charges (freight, labor, discount), per-supplier AP subledger, partial payments, and document-level void/cancel with full stock and JE reversal.

---

## UI Entry Points

| Surface | Route / Drawer | Purpose |
|---|---|---|
| Purchases list | `view: purchases` | List all POs with status, payment status, return lock indicator |
| Add Purchase | `drawer: addPurchase` | Create new PO (draft or direct to final) |
| View Purchase | `ViewPurchaseDetailsDrawer` | Read-only detail view with payment history |
| Edit Purchase | `EditPurchaseDrawer` (launched from View) | Edit header/items/charges on non-locked POs |
| Add Payment | `AddPaymentModal` | Record supplier payment against a final/received PO |
| Add Supplier | `AddSupplierModal` | Inline supplier creation from PurchaseForm |

---

## Frontend Files

| File | Role |
|---|---|
| `src/app/purchases/PurchasesPage.tsx` | Page container; loads `PurchaseContext`; renders list + drawers |
| `src/app/purchases/PurchaseForm.tsx` (or equivalent) | Form for create/edit — items, charges, supplier selection |
| `src/app/purchases/PurchaseList.tsx` | Paginated list with status badges, lock icons, action menus |
| `src/app/purchases/ViewPurchaseDetailsDrawer.tsx` | Detail drawer; shows items, charges, payment history |
| `src/app/purchases/AddPaymentModal.tsx` | Payment capture: amount, method, account, date |
| `src/app/purchases/AddSupplierModal.tsx` | Inline supplier (contact) creation |
| `src/app/context/PurchaseContext.tsx` | React context; exposes `createPurchase`, `updatePurchase`, `deletePurchase`, `recordPayment`, `updateStatus`, `receiveStock`, `refreshPurchases` |

---

## Backend Services

| Service | File | Role |
|---|---|---|
| `purchaseService` | `src/app/services/purchaseService.ts` | CRUD, status transitions, payment recording, cascade delete |
| `purchaseAccountingService` | `src/app/services/purchaseAccountingService.ts` | JE creation, edit adjustment JEs, document reversal |
| `supplierPaymentService` | `src/app/services/supplierPaymentService.ts` | Canonical payment JE (Dr AP / Cr Cash-Bank); called by `purchaseService.recordPayment` |
| `documentPostingEngine` | `src/app/services/documentPostingEngine.ts` | Orchestrates `postPurchaseDocumentAccounting` / `reversePurchaseDocumentAccounting` on status change |
| `partySubledgerAccountService` | `src/app/services/partySubledgerAccountService.ts` | Resolves supplier-specific AP subledger account (`resolvePayablePostingAccountId`) |
| `productService` | `src/app/services/productService.ts` | `createStockMovement` — called from context on finalize |
| `documentNumberService` | `src/app/services/documentNumberService.ts` | `getNextDocumentNumberGlobal(companyId, 'PUR' | 'PDR' | 'POR')` |
| `journalTransactionDateSyncService` | `src/app/services/journalTransactionDateSyncService.ts` | Keeps JE `entry_date` in sync when `po_date` is edited |

---

## DB Tables

| Table | Key Columns | Notes |
|---|---|---|
| `purchases` | `id, company_id, branch_id, po_no, draft_no, order_no, po_date, supplier_id, supplier_name, status, payment_status, subtotal, discount_amount, tax_amount, shipping_cost, total, paid_amount, due_amount` | `po_no` = null until status reaches received/final; `draft_no` (PDR-) for draft; `order_no` (POR-) for ordered |
| `purchase_items` | `id, purchase_id, product_id, variation_id, product_name, sku, quantity, unit, unit_price, discount_amount, tax_amount, total, packing_type, packing_quantity, packing_unit, packing_details` | `packing_details` JSONB: `{total_boxes, total_pieces, total_meters}` |
| `purchase_charges` | `id, purchase_id, charge_type, amount, ledger_account_id, created_by` | One row per charge line (freight, labor, discount, etc.) |
| `stock_movements` | `id, company_id, branch_id, product_id, variation_id, movement_type, quantity, unit_cost, total_cost, reference_type, reference_id, box_change, piece_change` | `reference_type='purchase'`, `movement_type='purchase'` for stock-in |
| `journal_entries` | `id, company_id, branch_id, entry_no, entry_date, description, reference_type, reference_id, payment_id, action_fingerprint, is_void` | Document JE: `payment_id IS NULL`; payment JE: `payment_id` set |
| `journal_entry_lines` | `id, journal_entry_id, account_id, debit, credit, description` | — |
| `payments` | `id, company_id, branch_id, reference_type, reference_id, amount, payment_method, payment_account_id, payment_date, voided_at` | `reference_type='purchase'` for bill payments |
| `payment_allocations` | `id, purchase_id, payment_id, allocated_amount, allocation_date, allocation_order` | Links manual (on-account) payments to a purchase bill |
| `accounts` | `id, company_id, code, name, type, is_group, is_active` | AP control account code `2000`; supplier subledger under `2000`/`2100`; Inventory `1200`; Discount Received `5210` |
| `document_sequences` | `id, company_id, branch_id, document_type, prefix, current_number, padding` | Number sequences for PUR/PDR/POR/purchase_return |

---

## Purchase Create Flow (Draft → Items → Charges → Finalize)

### Create (any status)

Entry point: `purchaseService.createPurchase(purchase, items, charges?)`.

1. `buildPurchaseInsertRow(purchase)` — sanitizes to `PURCHASE_INSERT_KEYS`; `po_no` is set to null unless status is already final/received.
2. Insert row into `purchases` → returns `purchaseData` with generated `id`.
3. Map `items` through `buildPurchaseItemInsertRow` → insert into `purchase_items`. On 400 (missing column), falls back to `buildPurchaseItemInsertRowMinimal`.
4. If `charges` array provided: filter `amount > 0`, insert rows into `purchase_charges` with `charge_type` and optional `ledger_account_id`. Failure here is non-fatal (warns, does not rollback header).
5. `dispatchContactBalancesRefresh(companyId)` — signals contact balance widgets to refresh.

### Document number lifecycle

| Status | Number field | Prefix | Source |
|---|---|---|---|
| `draft` | `draft_no` | `PDR-` | `documentNumberService.getNextDocumentNumberGlobal(companyId, 'PDR')` |
| `ordered` | `order_no` | `POR-` | `getNextDocumentNumberGlobal(companyId, 'POR')` |
| `received` / `final` | `po_no` | `PUR-` | Allocated in `ensurePostedPurchasePoNoAllocated` at the moment of status transition |

The display number used in lists is derived by `getPurchaseDisplayNumber` (from `src/app/lib/documentDisplayNumbers.ts`): returns `po_no` if set, else `draft_no` or `order_no`.

---

## Purchase Finalize Flow (Stock In, JE Posting)

Triggered by `purchaseService.updatePurchaseStatus(id, 'final')` (or `'received'`).

1. **PO number allocation** — `ensurePostedPurchasePoNoAllocated(purchaseId, row)`:
   - If `po_no` is empty or still matches `/^(PDR-|POR-)/i`, allocates next `PUR-` number via `documentNumberService`.
   - Patches `purchases.po_no` in DB. If allocation fails, status is rolled back to previous value and error is thrown.

2. **Document accounting post** — `postPurchaseDocumentAccounting(id)` (from `documentPostingEngine`), called fire-and-forget with `.catch()`:
   - Internally calls `purchaseAccountingService.createPurchaseJournalEntry(...)`.
   - Guard: `assertPurchaseEligibleForDocumentJournal` — checks `canPostAccountingForPurchaseStatus(status)` and that `po_no` is non-empty. Blocked for draft/ordered.
   - Idempotent: `findActiveCanonicalPurchaseDocumentJournalEntryId(purchaseId)` returns existing JE id if already posted.

3. **Stock movement** — handled from `PurchaseContext` (not `purchaseService`), calling `productService.createStockMovement(...)`:
   - `movement_type: 'purchase'`
   - `quantity: +N` (positive, stock in)
   - `unit_cost: item.unit_price`
   - `total_cost: item.total`
   - `reference_type: 'purchase'`, `reference_id: purchaseId`
   - Packing: `box_change` and `piece_change` from `packing_details`.
   - Guard: `canPostStockForPurchaseStatus(status)` must be true.

**Status gate** (`src/app/lib/postingStatusGate.ts`):
- `canPostAccountingForPurchaseStatus`: true for `received` and `final` only.
- `canPostStockForPurchaseStatus`: same set.
- `wasPurchasePostedForReversal`: true if prior status was received/final (used before cancel to determine if stock reversal is needed).

---

## Purchase Edit Flow

Entry point: `purchaseService.updatePurchase(id, updates)`.

**Pre-edit guards:**
- Status `cancelled` → throws immediately.
- Any `purchase_returns` with `status='final'` linked to this purchase → throws "locked" error. The `hasReturn` flag is also attached to purchase objects in `getPurchase` and `getPurchaseSplit`.

**Header update:**
- Sanitizes to `PURCHASE_INSERT_KEYS`; maps `discount` → `discount_amount`, `purchaseNo` → `po_no`.
- If `po_date` changes, calls `syncJournalEntryDateByDocumentRefs({ referenceTypes: ['purchase', 'purchase_adjustment'], referenceId: id, entryDate })` to keep JE dates in sync.

**Items/charges update (from context / form):**
- `purchaseService.replacePurchaseCharges(purchaseId, charges, createdBy)` — delete all existing charges for purchase, re-insert new set.
- Items: existing items are deleted and replaced (handled in PurchaseContext `updatePurchase` path).

**Accounting adjustment JEs** — `purchaseAccountingService.postPurchaseEditAdjustments(...)`:
- Builds `PurchaseAccountingSnapshot` (old and new) from `getPurchaseAccountingSnapshot`.
- Posts delta JEs only for: subtotal change, discount change, other-charges change.
- Never blanket-reverses original document JE. Never touches `payment_id` JEs.
- Each adjustment JE:
  - `reference_type: 'purchase_adjustment'`
  - `reference_id: purchaseId`
  - `action_fingerprint: 'purchase_adjustment:{companyId}:{purchaseId}:{description}'`
  - Idempotent: `accountingService.hasExistingPurchaseAdjustmentByDescription` prevents duplicates.
- Subtotal delta > 0: Dr Inventory (1200), Cr AP subledger. Delta < 0: Dr AP, Cr Inventory.
- Discount delta > 0: Dr AP, Cr Discount Received (5210). Delta < 0: reverse.
- Other-charges delta > 0: Dr Inventory (1200), Cr AP. Delta < 0: reverse.

---

## Purchase Void/Cancel Flow

Entry point: `purchaseService.cancelPurchase(id)` → `purchaseService.updatePurchaseStatus(id, 'cancelled')`.

1. **Guard — was it ever posted?** `wasPurchasePostedForReversal(priorStatus)`.
   - If `false` (draft/ordered): simply updates `status = 'cancelled'`. No stock or JE action.
   - If `true` (received/final): proceeds to reversal steps.

2. **Stock reversal** — looks up `stock_movements` where `reference_type='purchase'`, `reference_id=id`, `movement_type='purchase'`. For each movement, inserts a new row with `movement_type='PURCHASE_CANCELLED'` and `quantity = -(original qty)`. Idempotent: skips if `PURCHASE_CANCELLED` row already exists.

3. **JE reversal** — `reversePurchaseDocumentAccounting(id)` (from `documentPostingEngine`), called fire-and-forget with `.catch()`:
   - Internally calls `purchaseAccountingService.reversePurchaseDocumentJournalEntry(...)`.
   - Finds canonical document JE (`reference_type='purchase'`, `payment_id IS NULL`, `is_void` false/null).
   - Mirrors all lines with debits/credits swapped into a new JE with `reference_type='purchase_reversal'`.
   - Original document JE is **kept** for audit trail (not voided or deleted).
   - Idempotent: checks for existing `purchase_reversal` JE before creating.

4. **Delete flow** (`purchaseService.deletePurchase`): only for non-cancelled purchases. Cascade order:
   1. Payments (`deletePaymentDirect` per payment id)
   2. Stock reversal movements (insert `adjustment` type) then delete original `purchase` movements
   3. Journal entries (lines first, then headers)
   4. Activity logs
   5. Purchase items
   6. Purchase header

**Restore cancelled** — `purchaseService.restoreCancelledPurchase(id, target, companyId)`:
- Target `'draft'`: clears `po_no`, assigns new `PDR-` draft_no.
- Target `'ordered'`: clears `po_no`, assigns new `POR-` order_no.
- Historical reversal stock movements remain for audit.

---

## Payment Flow

Entry point: `purchaseService.recordPayment(purchaseId, amount, paymentMethod, accountId, companyId, branchId, ...)`.

**Guards:**
- Status must be `received` or `final` (`canPostAccountingForPurchaseStatus`). Cancelled purchases block payment.
- `accountId` is required.

**Recording:**
- Delegates to `createSupplierPayment(...)` from `supplierPaymentService`.
- Creates one row in `payments` (`reference_type='purchase'`, `reference_id=purchaseId`).
- Creates one payment JE: Dr AP subledger / Cr Cash or Bank account.
- Payment JE uses `payment_id` on `journal_entries` — this is how it is separated from the document JE.
- `recalc_purchase_payment_totals` RPC re-calculates `paid_amount`, `due_amount`, and `payment_status` on the `purchases` row.

**Payment update** — `purchaseService.updatePayment(paymentId, purchaseId, updates)`:
- Updates `payments` row.
- Amount changed: posts a delta JE via `postPaymentAmountAdjustment` (from `paymentAdjustmentService`).
- Account changed: posts a transfer JE via `postPaymentAccountAdjustment`.
- Date changed: syncs JE `entry_date` via `syncJournalEntryDateByPaymentId`.
- Original payment JE is never deleted or reversed; only incremental correction JEs are added.

**On-account payment** — `purchaseService.recordOnAccountPayment(contactId, ...)`:
- No `purchaseId` — linked to supplier contact only.
- Delegates to `createSupplierPayment` with `contactId` instead of `purchaseId`.

**Payment display** — `purchaseService.getPurchasePayments(purchaseId)`:
- Returns direct `payments` rows (`reference_type='purchase'`) plus `payment_allocations` rows (manual/on-account payments linked via `payment_allocations.purchase_id`).
- Skips rows where `voided_at IS NOT NULL`.

---

## Stock Effect

| Event | `movement_type` | `quantity` | `reference_type` | `reference_id` |
|---|---|---|---|---|
| Finalize purchase | `purchase` | +N (positive) | `purchase` | purchase id |
| Cancel posted purchase | `PURCHASE_CANCELLED` | -N (negative) | `purchase` | purchase id |
| Delete purchase | `adjustment` | -N (negative) | `purchase` | purchase id |

`total_cost` on `stock_movements` = item total at purchase price (not selling price).
`unit_cost` = `unit_price` from `purchase_items`.

---

## Accounting Effect

### Purchase document JE

Posted by `purchaseAccountingService.createPurchaseJournalEntry`.

```
Dr  Inventory (1200)         = subtotal (items)
Cr  AP subledger             = subtotal

For each charge (freight/labor/extra):
  Dr  Inventory (1200)       = charge amount
  Cr  AP subledger           = charge amount

For each discount charge:
  Dr  AP subledger           = discount amount
  Cr  Discount Received (5210) = discount amount
```

**JE fields:**
- `entry_no`: `JE-PUR-{timestamp}-{random6}`
- `reference_type`: `'purchase'`
- `reference_id`: purchase id
- `payment_id`: `NULL`
- `action_fingerprint`: `'purchase_document:{companyId}:{purchaseId}'`

AP account resolution priority:
1. `resolvePayablePostingAccountId(companyId, supplierContactId)` — supplier-specific subledger account.
2. Fallback: `accounts` row with `code='2000'` (Accounts Payable control).

### Edit adjustment JEs

`reference_type: 'purchase_adjustment'`
`action_fingerprint: 'purchase_adjustment:{companyId}:{purchaseId}:{description}'`
`entry_no`: `JE-PUR-ADJ-{timestamp}-{random6}`

### Cancel reversal JE

`reference_type: 'purchase_reversal'`
`entry_no`: `JE-PUR-REV-{timestamp}-{random6}`
Original document JE preserved; reversal mirrors lines with debit/credit swapped.

### Payment JE

Created by `supplierPaymentService` / `createSupplierPayment`. Not part of `purchaseAccountingService`.
```
Dr  AP subledger             = payment amount
Cr  Cash / Bank account      = payment amount
```
`payment_id` is set on this JE row; `reference_type='purchase'`.

---

## Party Balance Effect

- On purchase finalize: AP subledger credited (supplier owes increased by document total).
- On payment: AP subledger debited (supplier balance reduced).
- On cancel: reversal JE debits AP (balance reduced back).
- Subledger account is per-supplier, resolved by `resolvePayablePostingAccountId`.
- `dispatchContactBalancesRefresh(companyId)` called after create/update/payment to trigger UI refresh.
- `ledgerUpdated` CustomEvent dispatched to supplier ledger widgets.

---

## Payment Status Tracking

`purchases.payment_status` values: `'paid'`, `'partial'`, `'unpaid'`.

Updated by DB RPC `recalc_purchase_payment_totals(p_purchase_id)` — called after:
- Every payment recorded (`recordPayment`)
- Every payment updated (`updatePayment`)
- Linked purchase return finalized (from `purchaseReturnService.finalizePurchaseReturn`)
- Linked purchase return voided

`paid_amount` and `due_amount` are maintained on the `purchases` row by the RPC. UI reads these directly.

---

## Reports Impact

- **Purchase Register / Purchase Report**: reads `purchases` + `purchase_items` filtered by `company_id`, `branch_id`, `po_date`.
- **Stock Valuation / Inventory Report**: reads `stock_movements` where `movement_type='purchase'`. `total_cost` = purchase price.
- **AP Ledger / Supplier Statement**: reads `journal_entry_lines` for AP subledger account; also reads `payments` directly.
- **Day Book**: reads `journal_entries` filtered by `entry_date`.
- **Profit & Loss**: Inventory (1200) debit from purchase does not hit P&L directly; cost flows to COGS only on sale (via `stock_movements` with `movement_type='sale'`).

---

## Source of Truth

| Data | Source |
|---|---|
| Purchase header | `purchases` table |
| Line items | `purchase_items` table |
| Extra charges | `purchase_charges` table |
| Stock on hand | `stock_movements` aggregate |
| Supplier balance | `journal_entry_lines` for AP subledger account OR `payments` aggregate |
| Payment status | `purchases.payment_status` (maintained by RPC) |
| Document JE | `journal_entries` where `reference_type='purchase'` and `payment_id IS NULL` |
| Payment JE | `journal_entries` where `reference_type='purchase'` and `payment_id IS NOT NULL` |

---

## Known Failure Points

1. **Document accounting is fire-and-forget**: `postPurchaseDocumentAccounting(id).catch(warn)` — if it fails silently, the purchase is `final` in the DB but has no JE. No retry mechanism or alerting.

2. **Stock posting is in PurchaseContext, not in purchaseService**: stock movements are created by the React context, not the service layer. A direct DB call or API call that bypasses the context will produce a final purchase with no stock movement.

3. **Purchase_charges insert is non-fatal**: if `purchase_charges` insert fails (e.g. table does not exist in that tenant), charges are silently dropped. Accounting falls back to header totals, producing a JE without freight/labor line detail.

4. **Quantity validation gap on edit**: there is no check that new item quantities remain above already-returned quantities. Reducing an item quantity below the `already_returned` amount for that line leaves orphaned excess return data.

5. **Cancel reversal is also fire-and-forget**: `reversePurchaseDocumentAccounting(id).catch(warn)` — a cancel can succeed in the DB (status = cancelled) with no corresponding reversal JE.

6. **Delete hard-removes JEs**: `deletePurchase` deletes all `journal_entries` rows directly (not voids them). This removes audit history. Only permitted for non-cancelled purchases.

7. **Concurrent finalize race**: `updatePurchaseStatus` does not use optimistic locking or SELECT-FOR-UPDATE. Two concurrent finalize calls can both pass the status check and both attempt `postPurchaseDocumentAccounting`. The JE creation is idempotent (fingerprint check), but duplicate `PUR-` number allocation is possible if `documentNumberService` is not atomic.

8. **`payment_status` staleness**: `recalc_purchase_payment_totals` is an RPC called after payments, but not after purchase total edits. If a purchase total is edited, `due_amount` and `payment_status` may be stale until the next payment event.

9. **Schema fallback inserts**: `buildPurchaseItemInsertRowMinimal` uses old column names (`discount`, `tax` instead of `discount_amount`, `tax_amount`). If a new DB tenant has only the old schema, data is inserted with mismatched field names and the accounting snapshot computation (`getPurchaseAccountingSnapshot`) may read wrong values.

---

## Recommended Standard

1. **Move stock posting into `purchaseService`** (or a shared finalize function) so it is not skippable by bypassing the context. Mirror the pattern in `purchaseReturnService.finalizePurchaseReturn`.

2. **Make document accounting awaited, not fire-and-forget**. If the JE fails, roll back the status change. At minimum, surface a warning to the UI rather than silently continuing.

3. **Post a `purchase_charges` failure alert**: if the insert fails, mark the purchase with a flag (`accounting_incomplete = true`) so an admin can reprocess.

4. **Add a quantity guard on edit**: before saving updated item quantities, check `getOriginalPurchaseItems` (already done in return flow) to ensure no item is reduced below its returned quantity.

5. **Use RPC or DB trigger for `recalc_purchase_payment_totals`**: trigger it on any `purchases.total` update, not just payment events.

6. **Void JEs on delete instead of hard-deleting**: set `is_void = true` on journal entries so audit history is preserved.

7. **Add idempotency to stock posting**: before inserting a `purchase` movement, check if one already exists for `(reference_type='purchase', reference_id=purchaseId, movement_type='purchase')` — same pattern as `purchaseReturnHasStockLine`.
