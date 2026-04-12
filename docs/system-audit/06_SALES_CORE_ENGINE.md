# 06 — Sales Core Engine

**Last updated:** 2026-04-12
**Stack:** Next.js + Supabase (multi-tenant)
**Scope:** Full sale lifecycle — create, finalize, edit, cancel, delete, payment recording

---

## Business Purpose

The Sales module is the primary revenue capture point in the ERP. It manages customer invoices from point-of-sale through settlement, tracks stock depletion, posts double-entry journal entries (AR/Revenue + COGS/Inventory), and feeds AR subledger balances, inventory valuation, and all financial reports. Every finalized sale is an immutable financial event that can only be reversed by cancellation or a matched sale return.

---

## UI Entry Points

| Entry Point | Route / Drawer | Description |
|---|---|---|
| Sales List | `/sales` (view: `sales`) | Paginated list of all sales for the active branch |
| Add Sale | Drawer: `addSale` | New invoice / quotation / order creation form |
| Edit Sale | Drawer: `edit-sale` | Edit draft or final sale header and line items |
| View Sale Details | `ViewSaleDetailsDrawer` | Read-only detail view with payment history and audit info |
| Studio Sales | Separate sub-view (`is_studio=true`) | Filtered list for studio orders (STD- prefix) |

---

## Frontend Files

| File | Purpose |
|---|---|
| `SalesPage` | Root page for the `/sales` view; renders SalesList and controls drawers |
| `SaleForm` / `SalesEntry` | Form component shared by add and edit drawers; handles line items, charges, discounts, payment method selection |
| `SalesList` | Table/list component showing paginated sales with status badges, totals, return indicators |
| `ViewSaleDetailsDrawer` | Read-only panel showing full sale detail, payment timeline, and shipment status |
| `SalesContext.tsx` | React context providing `sales`, `createSale`, `updateSale`, `deleteSale`, `recordPayment`, `convertQuotationToInvoice`, and pagination state (`page`, `pageSize`, `totalCount`) |

**SalesContext key imports:**

- `saleService` — all DB operations
- `useDocumentNumbering` — invoice number allocation
- `useAccounting` — triggers JE creation on finalize
- `canPostAccountingForSaleStatus` / `canPostStockForSaleStatus` — posting gate guards
- `assertDomainEditSafetyTestMode` / `classifySalesEdit` — edit classification for delta JEs
- `createAccountingEditTraceId` / `pushAccountingEditTrace` — edit audit trail

---

## Backend Services

### `saleService.ts` — Key Functions

| Function | Description |
|---|---|
| `createSale(sale, items, options?)` | Inserts sale header + items. Validates stock if `allowNegativeStock=false`. Handles deadline column fallback and invoice_no duplicate recovery. Rolls back sale if items insert fails. |
| `getSaleById(saleId)` | Fetches full sale with items (sales_items fallback to sale_items), charges, return lock status (`hasReturn`, `returnCount`), and enriched creator name. |
| `getSale(id)` | Lightweight fetch for edit form including `sale_charges`. Also checks `hasReturn`. |
| `getAllSales(companyId, branchId?, opts?)` | Paginated list with enriched return counts, studio charges (RPC), shipping status (view). |
| `updateSale(id, updates)` | Updates draft or final sale. Blocks on cancelled status and on sales with final returns. Posts delta accounting JEs if sale was already final. Syncs JE `entry_date` when `invoice_date` changes. |
| `updateSaleStatus(id, status)` | Handles status transitions. On `cancelled`: creates `SALE_CANCELLED` stock reversals, then calls `reverseSaleDocumentAccounting`. On `final`: calls `ensureFinalSaleInvoiceNoAllocated` then `postSaleDocumentAccounting`. |
| `cancelSale(id, options?)` | Delegates to `updateSaleStatus(id, 'cancelled')`. |
| `deleteSale(id)` | Cascade hard-delete: payments → stock reversals (adjustment movements) → JEs → activity logs → sale_items → studio_productions → sale row. Blocked on cancelled sales. |
| `recordPayment(saleId, amount, method, accountId, ...)` | Inserts payment row (received type), normalizes payment method to DB enum, generates reference number, calls `ensureSalePaymentJournalAfterInsert`, asserts JE was created. Blocked on cancelled and non-final sales. |
| `replaceSaleCharges(saleId, charges, createdBy?)` | Delete-and-replace all `sale_charges` rows for a sale (idempotent upsert pattern). |
| `restoreCancelledSale(id, target, companyId)` | Moves cancelled sale back to draft/quotation/order. Allocates new stage number. Does not remove historical reversal JEs or stock rows. |
| `repairMissingFinalInvoiceNumber(id)` | QA utility: allocates SL/STD/PS invoice number for final sales missing one. |

### `saleAccountingService.ts` — Key Functions

| Function | Description |
|---|---|
| `createSaleJournalEntry(params)` | Posts the canonical sale document JE. Dr AR (1100) = total; Dr Discount Allowed (5200) if any; Cr Sales Revenue (4000) for product revenue; Cr Shipping Income (4110) for shipping charges. Then Dr COGS (5000) / Cr Inventory (1200) = sum of (qty × product.cost_price). Idempotent via `saleDocumentJournalFingerprint`. |
| `reverseSaleJournalEntry(params)` | Mirror-image reversal JE for cancelled sales. Requires an active canonical document JE to exist. `reference_type='sale_reversal'`. |
| `postSaleEditAdjustments(params)` | Posts delta-only adjustment JEs for four components: revenue, discount, extra charges, shipping. Each gets a separate `reference_type='sale_adjustment'` JE. Idempotent via description-based deduplication. Never touches payment JEs. |
| `getSaleAccountingSnapshot(sale)` | Builds `{ total, subtotal, discount, extraExpense, shippingCharges }` from a sale row + charge lines for delta comparison. |
| `createSaleReturnInventoryReversalJE(params)` | Posts the inventory reversal JE for a return: Dr Inventory (1200) / Cr COGS (5000). Idempotent via fingerprint `sale_return_cogs:<co>:<returnId>`. |
| `findActiveCanonicalSaleDocumentJournalEntryId(saleId)` | Returns the oldest active non-voided, non-payment document JE for idempotency and reversal guard. |
| `listActiveCanonicalSaleDocumentJournalEntryIds(saleId)` | Returns all active canonical document JE ids (used by Integrity Lab for duplicate detection). |
| `ensureSalePaymentJournalAfterInsert(paymentId)` | Called after payment insert to guarantee a payment JE exists (triggered or posted manually). |

---

## DB Tables

| Table | Role |
|---|---|
| `sales` | Sale header: status, totals, payment_status, invoice_no, customer_id, branch_id, company_id |
| `sales_items` | Line items (canonical; `sale_items` is legacy fallback) |
| `sale_charges` | Additional named charges per sale (shipping, stitching, freight, etc.) |
| `sale_returns` | Return headers linked to original sale via `original_sale_id` |
| `stock_movements` | Every stock depletion and reversal event |
| `journal_entries` | Double-entry accounting headers |
| `journal_entry_lines` | Debit/credit lines per journal entry |
| `payments` | Payment receipts linked to sales via `reference_type='sale'` |
| `accounts` | Chart of accounts (1100 AR, 4000 Revenue, 4110 Shipping, 5200 Discount, 5000 COGS, 1200 Inventory) |
| `contacts` | Customer records (joined to sales as `customer`) |
| `branches` | Branch lookup |

---

## Sale Create Flow

```
1. UI submits Sale + SaleItems + SaleCharges to SalesContext.createSale()
2. saleService.createSale() called:
   a. Check allowNegativeStock (caller flag OR settings DB flag)
   b. If final status and stock posting: validate stock availability per item per branch
   c. Build insertRow: set invoice_no=null if not yet final (draft_no/quotation_no/order_no used instead)
   d. INSERT into sales → returns saleData (with retry on deadline column missing, or duplicate invoice_no recovery)
   e. INSERT into sales_items (fallback: sale_items)
   f. On items insert error → DELETE sale (rollback)
   g. Fetch complete sale row (with items joined) to return to caller
3. auditLogService.logSaleAction() — fire-and-forget
4. If status=final: ensureFinalSaleInvoiceNoAllocated() → assigns SL-/STD-/PS- number
5. postSaleDocumentAccounting(saleId) — non-blocking; creates JEs
```

---

## Sale Finalize Flow

Finalization is `updateSaleStatus(id, 'final')` — either from a status change on an existing draft/order, or directly when creating with `status='final'`.

```
1. Fetch current sale status (guard: block if already cancelled)
2. UPDATE sales SET status='final'
3. ensureFinalSaleInvoiceNoAllocated():
   - If invoice_no is empty or still SDR-/SQT-/SOR-, allocate next SL-/STD-/PS-
   - Retry up to 12 times on unique constraint collision
4. postSaleDocumentAccounting(saleId) [non-blocking, via documentPostingEngine]:
   a. saleAccountingService.createSaleJournalEntry():
      - assertSaleEligibleForDocumentJournal() — status must be 'final' with a non-empty invoice_no
      - Idempotency check: findActiveCanonicalSaleDocumentJournalEntryId() — skip if exists
      - Resolve AR account (party subledger if customer_id set, else control 1100)
      - Build JE lines:
          Dr AR (1100)             = sale.total
          Dr Discount Allowed (5200) = sale.discount_amount  [if > 0]
          Cr Sales Revenue (4000)  = gross - shipping
          Cr Shipping Income (4110) = shipping charges        [if > 0]
      - getSaleCogs() → sum of (qty × product.cost_price) from sales_items
      - If COGS > 0:
          Dr COGS (5000)           = totalCogs
          Cr Inventory (1200)      = totalCogs
      - accountingService.createEntry() → persists JE + lines
      - action_fingerprint = saleDocumentJournalFingerprint(companyId, saleId)
5. Stock movements: created at item-insert time (if status=final on create); or via updateSaleStatus trigger path
   - movement_type = 'sale', quantity = negative, total_cost = negative (selling price)
```

**Note:** The `canPostAccountingForSaleStatus()` gate allows only `'final'` status. Draft, quotation, and order stages do not post JEs or stock.

---

## Sale Edit Flow

### Before Finalization (draft / quotation / order)
- Full edit allowed: header fields, line items, charges, status, payment method.
- No accounting or stock adjustments needed (nothing was posted).
- `updateSale()` performs a simple UPDATE + item replacement.

### After Finalization (status = 'final')
- Sale header (date, notes, customer, payment method) can be updated.
- Line items can be changed **only if no final sale returns exist** (`hasReturn=false`).
- Charges (shipping, extras) can be changed.
- On any edit to a final sale, `postSaleEditAdjustments()` computes a snapshot delta and posts `sale_adjustment` JEs for each changed component (revenue, discount, extra charges, shipping). The original document JE is never modified.
- If `invoice_date` changes, `syncJournalEntryDateByDocumentRefs()` syncs all JE `entry_date` values for this sale.
- Changing status from non-final to final triggers `postSaleDocumentAccounting()`.

### Hard Locks (cannot be overridden from UI)
- Cancelled sales: no edits, no payments, no delete.
- Sales with final returns: line item editing blocked (`hasReturn` check in `updateSale` + `getSaleById`).

---

## Sale Void / Cancel Flow

Sales use `status='cancelled'` (not `is_void`). There is no partial void.

```
cancelSale(id) → updateSaleStatus(id, 'cancelled'):

1. Fetch sale (invoice_no, branch_id, company_id, total, status)
2. priorPosted = wasSalePostedForReversal(status)
   - If NOT posted (draft/quotation/order): UPDATE status='cancelled' only. No stock/JE reversal.
3. If POSTED (was 'final'):
   a. Check for existing SALE_CANCELLED stock row (idempotency guard)
   b. Fetch all stock_movements WHERE reference_type='sale' AND reference_id=id AND movement_type='sale'
   c. For each: INSERT stock_movements with movement_type='SALE_CANCELLED', quantity=+abs, total_cost=+abs
   d. UPDATE sales SET status='cancelled'
   e. reverseSaleDocumentAccounting(id) [non-blocking]:
      - saleAccountingService.reverseSaleJournalEntry():
          Dr Sales Revenue (4000)    = gross
          Dr Shipping Income (4110)  = shipping [if any]
          Cr Discount Allowed (5200) = discount  [if any]
          Cr AR (1100)               = total
          Dr Inventory (1200)        = totalCogs
          Cr COGS (5000)             = totalCogs
      - reference_type = 'sale_reversal'
```

**Delete** (`deleteSale`) is a hard cascade that removes all related data and is only available on non-cancelled sales. It uses `movement_type='adjustment'` (positive) to restore stock, then physically deletes JEs and the sale row.

---

## Stock Effect

| Event | `movement_type` | `quantity` | `total_cost` | `reference_type` |
|---|---|---|---|---|
| Sale finalized | `sale` | negative (outflow) | negative (selling price) | `sale` |
| Sale cancelled | `SALE_CANCELLED` | positive (reversal) | positive | `sale` |
| Sale deleted | `adjustment` | positive (reversal) | positive | `sale` |

- `unit_cost` on the sale stock movement = selling price per unit (retail inventory method, not product.cost_price).
- `total_cost` = `quantity × unit_cost` (negative for outflows).
- Variation-specific movements use `variation_id` for accurate per-SKU tracking.

---

## Accounting Effect

### On Finalize — Two JEs in one `createEntry` call

**JE 1: Revenue + AR**
```
Dr Accounts Receivable / Party Subledger (1100)     = sale.total
Dr Discount Allowed (5200)                           = sale.discount_amount  [if any]
   Cr Sales Revenue (4000)                           = gross - shipping
   Cr Shipping Income (4110)                         = shipping charges       [if any]
```

**JE 2: COGS (same JE if totalCogs > 0)**
```
Dr Cost of Production / COGS (5000)                 = sum(qty × cost_price)
   Cr Inventory (1200)                               = sum(qty × cost_price)
```

Both JE halves are written in a single `accountingService.createEntry()` call as one `journal_entries` row with multiple `journal_entry_lines`.

**Fingerprint:** `sale_document:<companyId>:<saleId>` — ensures exactly one canonical document JE per sale.

**Reference type:** `'sale'` — marks it as source-owned; cannot be edited from the Journal Entry page.

### On Cancel — Reversal JE (`reference_type='sale_reversal'`)
Exact mirror of the create JE: Revenue and AR swapped, Inventory and COGS swapped.

### On Edit — Delta JEs (`reference_type='sale_adjustment'`)
One JE per changed component. Idempotent per description string. The original document JE is preserved in full.

---

## Party Balance Effect

- When `customer_id` is set: `resolveReceivablePostingAccountId()` resolves a party-specific subledger account under AR (1100). The Dr line hits this subledger, so the customer's ledger balance reflects the outstanding receivable.
- When no `customer_id` (walk-in): control account 1100 is used directly.
- `dispatchContactBalancesRefresh(companyId)` fires after JE creation and after payment to trigger real-time balance recalculation.

---

## Payment Status

| Status | Condition |
|---|---|
| `paid` | `paid_amount >= total` |
| `partial` | `paid_amount > 0 AND paid_amount < total` |
| `unpaid` | `paid_amount = 0` |

- Payment status is stored on the `sales` row as `payment_status`.
- Updated via the DB RPC `recalc_sale_payment_totals(p_sale_id)` after each payment or return.
- `due_amount = total - paid_amount` (plus `studio_charges` for studio sales).
- `return_due` tracks credit owed to customer from accepted returns.
- Payments are only accepted on `final` status sales. The gate is `canPostAccountingForSaleStatus(status)`.

---

## Reports Impact

| Report | Dependency |
|---|---|
| Revenue / P&L | Sales Revenue (4000) JE lines |
| Accounts Receivable Aging | AR (1100) / party subledger JE lines |
| Inventory Valuation | COGS (5000) / Inventory (1200) JE lines; stock_movements |
| Customer Ledger | AR JE lines + payment JE lines (filtered by customer subledger account) |
| Sales Summary | `sales` table, `status='final'`, `payment_status` |
| Cash / Bank Book | Payment JE lines referencing Cash (1000) or Bank (1010) accounts |
| Commission Report | `sales.commission_amount`, `commission_status` |

Voided / cancelled sales are excluded from revenue reports by default (reversal JEs net to zero).

---

## Source of Truth

| Data Point | Source |
|---|---|
| Sale total | `sales.total` |
| Payment received | `payments` table (aggregated via `recalc_sale_payment_totals`) |
| Stock depletion | `stock_movements` (movement_type='sale') |
| Revenue posted | `journal_entry_lines` Cr to account 4000 |
| AR balance | `journal_entry_lines` Dr to account 1100 / subledger |
| COGS | `journal_entry_lines` Dr to account 5000 |
| Return impact | `sale_returns` + `sale_return_items` |

---

## Editable vs Non-Editable States

| Sale Status | Header Edit | Line Item Edit | Payment | Cancel | Delete |
|---|---|---|---|---|---|
| `draft` | Yes | Yes | No | Yes (no reversal) | Yes |
| `quotation` | Yes | Yes | No | Yes (no reversal) | Yes |
| `order` | Yes | Yes | No | Yes (no reversal) | Yes |
| `final` (no returns) | Yes | Yes | Yes | Yes (with reversal) | No |
| `final` (has returns) | Yes (header only) | **Blocked** | Yes | Yes (with reversal) | No |
| `cancelled` | **Blocked** | **Blocked** | **Blocked** | N/A | **Blocked** |

---

## Source-Owned Protections

### `action_fingerprint`
Format: `sale_document:<companyId>:<saleId>`

The canonical sale document JE carries this fingerprint. `findActiveCanonicalSaleDocumentJournalEntryId()` checks for it before creating any new JE, making `createSaleJournalEntry` fully idempotent. A second call returns the existing JE id without posting a duplicate.

### `reference_type = 'sale'` guard
Journal entries with `reference_type='sale'` are considered source-owned. The Journal Entry page enforces a read-only policy for these rows — they can only be reversed via the sale cancel/void path, never edited directly from the accounting UI.

### `payment_id IS NULL` separation
Document JEs (Dr AR / Cr Revenue) always have `payment_id IS NULL`. Payment receipt JEs set `payment_id`. This separation prevents payment JEs from being counted as or interfering with document JEs during idempotency and reversal checks.

---

## Known Failure Points

1. **COGS computed from `product.cost_price` not selling price.** The COGS JE in `createSaleJournalEntry` uses `getSaleCogs()` which reads `products.cost_price`. Stock movement `total_cost` uses the selling price. These two values are inconsistent. If `cost_price` is zero (products without cost set), no COGS JE is posted but stock movements still record negative value.

2. **Dual table fallback complexity.** Both `sales_items` (canonical) and `sale_items` (legacy) are queried in multiple service functions with fallback logic. This creates maintenance debt — a migration to fully deprecate `sale_items` is pending.

3. **Non-blocking JE creation.** `postSaleDocumentAccounting()` is called with `.catch()` and will not surface to the UI if it fails silently. A sale can appear `final` in the DB while the accounting JE was never posted.

4. **Delete vs Cancel inconsistency.** `deleteSale` uses `movement_type='adjustment'` for stock reversal, while `cancelSale` uses `movement_type='SALE_CANCELLED'`. Reports that filter by movement type may treat these differently.

5. **Stock movement uses selling price for `total_cost`.** The retail inventory method means COGS on the stock ledger equals the sale value, not the purchase cost. This inflates apparent inventory cost when stock valuation reports use `stock_movements.total_cost` rather than `products.cost_price`.

6. **Duplicate invoice_no recovery is best-effort.** The `ensureFinalSaleInvoiceNoAllocated` loop retries up to 12 times on unique constraint collision. Under extreme parallel load this could exhaust retries and throw, leaving the sale in final status without a valid invoice_no.

---

## Recommended Standard

1. **Always finalize via `updateSaleStatus(id, 'final')`** — never manually set status without going through this function, as it handles invoice_no allocation and triggers accounting.

2. **Never delete final sales in production.** Use `cancelSale` instead to preserve the audit trail. Reserve hard delete for draft/test data only.

3. **Set `product.cost_price` on all products** before going live to ensure COGS JEs are non-zero and inventory valuation is accurate.

4. **Migrate fully to `sales_items`.** Remove all `sale_items` fallback branches once migration is confirmed complete — the dual-table pattern is a reliability risk.

5. **Verify JE was posted after finalize.** After calling `updateSaleStatus(id, 'final')`, call `findActiveCanonicalSaleDocumentJournalEntryId(saleId)` to confirm the JE exists. Do not assume non-blocking posting succeeded.

6. **Do not use `createExtraExpenseJournalEntry` for invoice add-ons.** That function is deprecated. All customer-facing charges (shipping, stitching, etc.) are included in the main sale JE via the AR credit line and must be entered as `sale_charges`, not separate expense JEs.
