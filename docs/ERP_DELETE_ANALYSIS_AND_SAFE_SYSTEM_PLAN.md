# ERP Web Application – Delete Analysis & Safe System Plan

**Date:** February 2026  
**Scope:** Web Application (src/) – Sales, Purchase, Inventory, Expense, Rental  
**Goal:** Data integrity, stock/ledger consistency, audit compliance, scalable multi-user/multi-branch

---

## STEP 1 – DELETE ANALYSIS

### 1.1 Current Delete Behavior Summary

| Module | Delete Type | Status Check | Stock | Ledger | Journal | Audit | Invoice Reuse |
|--------|-------------|--------------|-------|--------|---------|-------|---------------|
| **Sales** | Hard delete | ❌ None | ✅ Reverse | ❌ Delete | ❌ Delete | ❌ Delete | ✅ No reuse |
| **Purchase** | Hard delete | ❌ None | ✅ Reverse | ❌ Delete | ❌ Delete | ❌ Delete | ✅ No reuse |
| **Expense** | Soft delete | ❌ None | N/A | ❌ No reverse | ❌ No reverse | ❌ No log | ✅ No reuse |
| **Rental** | Hard delete | ✅ Draft/Booked only | N/A | ❌ Delete | ❌ Delete | ✅ Log | ✅ No reuse |
| **Sale Return** | Hard delete | ✅ Draft only | N/A | ❌ Delete | ❌ Delete | ❌ No log | N/A |
| **Purchase Return** | Hard delete | ✅ Draft only | N/A | ❌ Delete | ❌ Delete | ❌ No log | N/A |

---

### 1.2 Module-wise Detail

#### SALES (`saleService.deleteSale`)

**What happens:**
1. **Payments** → Deleted (each payment: journal entries deleted, payment record deleted; DB triggers create reverse journal entry)
2. **Stock** → ✅ Reverse movement created (positive qty to restore stock), then original movements deleted
3. **Ledger entries** → ❌ **DELETED** (customer ledger – no reverse entry, audit trail lost)
4. **Journal entries** → ❌ **DELETED** (sale-related; no reverse entry)
5. **Activity logs** → ❌ **DELETED** (audit trail removed)
6. **Sale items** → Deleted
7. **Sale record** → Permanently deleted

**Status check:** ❌ **NONE** – Delete allowed for draft, quotation, order, AND final. UI shows Delete for all sales (except edit locked when sale has return).

**Invoice number:** Uses `document_sequences` table – sequence never decrements. ✅ **No reuse.**

---

#### PURCHASE (`purchaseService.deletePurchase`)

**What happens:**
1. **Payments** → Deleted (same as sale – reverse journal via trigger)
2. **Stock** → ✅ Reverse movement created (negative qty), then original movements deleted
3. **Ledger entries** → ❌ **DELETED** (supplier ledger)
4. **Journal entries** → ❌ **DELETED**
5. **Activity logs** → ❌ **DELETED**
6. **Purchase items** → Deleted
7. **Purchase record** → Permanently deleted

**Status check:** ❌ **NONE** – Delete allowed for all statuses.

**PO number:** Same `document_sequences` – ✅ **No reuse.**

---

#### EXPENSE (`expenseService.deleteExpense`)

**What happens:**
- **Soft delete:** `status = 'rejected'` (row remains)
- ❌ No ledger reverse
- ❌ No journal reverse
- ❌ No activity log for “expense cancelled”
- Expense still appears in DB; reports may need to filter `status != 'rejected'`

**Status check:** ❌ None – any expense can be “deleted” (rejected).

---

#### RENTAL (`rentalService.deleteRental`)

**What happens:**
- ✅ **Status check:** Only `draft` or `booked` can be deleted
- Hard delete: `rental_items` → `rentals`
- ✅ Activity log: `rental_deleted` (after delete)
- ❌ No stock reversal (rentals typically don’t affect stock until pickup)
- ❌ Ledger/journal – depends on rental accounting design

---

#### SALE RETURN / PURCHASE RETURN

- **Sale Return:** Draft only; hard delete. Final returns cannot be deleted.
- **Purchase Return:** Draft only; hard delete.

---

### 1.3 Report: Delete Impact

| Impact Area | Current State | Risk |
|-------------|---------------|------|
| **Stock** | Reverse movement created before delete | ✅ Low – stock restored |
| **Ledger** | Entries deleted, no reverse | 🔴 High – ledger mismatch, no audit |
| **Journal** | Entries deleted, no reverse | 🔴 High – accounting mismatch |
| **Reports** | Deleted records vanish | 🔴 High – P&L, aging, history gaps |
| **Audit** | Activity logs deleted | 🔴 High – no trace of who deleted what |
| **Invoice reuse** | document_sequences – no reuse | ✅ OK |
| **Data integrity** | Hard delete, no soft flag | 🔴 High – irreversible |
| **Multi-user** | No cancel reason, no user tracking | 🔴 Medium |

---

## STEP 2 – SAFE SYSTEM DESIGN

### 2.1 Rules

1. **Draft documents** → Allowed to delete (hard delete OK for drafts).
2. **Final documents** → No permanent delete; use Cancel / Soft Reverse.
3. **Cancel flow:**
   - Status = `cancelled` (or `void`)
   - Auto Credit Note (Sales) / Debit Note (Purchase)
   - Stock reverse
   - Ledger reverse entry
   - Journal reverse entry
   - Cancel reason mandatory
   - User ID + timestamp in audit log
4. **Invoice/PO number** → Never reuse (already satisfied).
5. **Audit trail** → Full history of cancels.

---

### 2.2 UI Changes

| Document Type | Current Button | New Button | Behavior |
|---------------|----------------|------------|----------|
| Sale (draft) | Delete | Delete | Hard delete (allowed) |
| Sale (final) | Delete | Cancel Invoice | Soft reverse + Credit Note |
| Purchase (draft) | Delete | Delete | Hard delete (allowed) |
| Purchase (final) | Delete | Cancel PO | Soft reverse + Debit Note |
| Expense | Delete | Cancel Expense | Soft reverse (status + ledger reverse) |
| Rental (draft/booked) | Delete | Delete | Keep current (hard delete) |
| Rental (picked_up/returned) | Cancel | Cancel | Soft reverse |

---

### 2.3 Database Changes

1. **Add `cancelled` / `void` to status enums** (if not present):
   - `sales`: `sale_status` – add `cancelled`
   - `purchases`: `purchase_status` – add `cancelled`
   - `expenses`: already has `rejected` – treat as cancel

2. **New columns (optional but recommended):**
   - `cancelled_at TIMESTAMPTZ`
   - `cancelled_by UUID REFERENCES users(id)`
   - `cancel_reason TEXT`
   - `credit_note_id UUID` (for sales – link to credit note)
   - `debit_note_id UUID` (for purchases)

3. **New tables (if needed):**
   - `sale_returns` / credit notes – may already exist
   - `purchase_returns` / debit notes – may already exist

4. **Activity log:** Never delete; add `cancelled` action with reason.

---

## STEP 3 – ARCHITECTURE UPDATE

### 3.1 Centralized Cancellation Service

```
src/app/services/
  cancellationService.ts    # Central cancel logic
  reverseStockService.ts     # Reusable stock reverse
  reverseLedgerService.ts    # Reusable ledger reverse
  reverseJournalService.ts   # Reusable journal reverse
```

### 3.2 Reusable Functions

```typescript
// cancellationService.ts
cancelSale(saleId, reason, userId): Promise<void>
cancelPurchase(purchaseId, reason, userId): Promise<void>
cancelExpense(expenseId, reason, userId): Promise<void>
```

Each cancel will:
1. Validate (status = final, no dependent returns, etc.)
2. Create Credit/Debit Note (Sales/Purchase)
3. Reverse stock
4. Reverse ledger
5. Reverse journal
6. Update status to cancelled
7. Log activity with reason + user + timestamp

### 3.3 Hard Delete Rules

- **Draft only:** `status IN ('draft', 'quotation', 'order')` for sales
- **Production:** Disable hard delete for final documents
- **Soft delete flag:** Use `status = 'cancelled'` instead of `is_deleted` (simpler for existing schema)

### 3.4 Report Filtering

- Default: `WHERE status != 'cancelled'` (and `status != 'rejected'` for expenses)
- Optional: “Show cancelled” filter for audit/review

---

## IMPLEMENTATION ORDER

### Phase 1 – Web (Priority)
1. Add `cancelled` to sale/purchase status enums (migration)
2. Add cancel columns (cancelled_at, cancelled_by, cancel_reason)
3. Create `cancellationService.ts` with cancelSale, cancelPurchase
4. Update SalesPage: hide Delete for final, show “Cancel Invoice” → open Cancel modal (reason required)
5. Update PurchasesPage: same for final purchases
6. Update Expense: improve soft delete (add cancel_reason, activity log)
7. Ensure all lists filter out cancelled by default

### Phase 2 – Refinement
1. Credit Note auto-generation for cancelled sales
2. Debit Note for cancelled purchases
3. Audit report: “Cancelled documents” view

### Phase 3 – Mobile
1. Apply same logic to erp-mobile-app
2. Replace direct delete API calls with cancel API
3. Add Cancel modal with reason field

---

## FILES TO MODIFY (Web)

| File | Change |
|------|--------|
| `src/app/services/saleService.ts` | Add `cancelSale()`, restrict `deleteSale()` to draft only |
| `src/app/services/purchaseService.ts` | Add `cancelPurchase()`, restrict `deletePurchase()` to draft only |
| `src/app/services/expenseService.ts` | Add cancel_reason, activity log to deleteExpense |
| `src/app/context/SalesContext.tsx` | Add cancelSale, update deleteSale guard |
| `src/app/context/PurchaseContext.tsx` | Add cancelPurchase, update deletePurchase guard |
| `src/app/components/sales/SalesPage.tsx` | Conditional Delete vs Cancel, Cancel modal |
| `src/app/components/purchases/PurchasesPage.tsx` | Same |
| `src/app/components/dashboard/ExpensesDashboard.tsx` | Cancel reason in delete flow |
| `supabase-extract/migrations/` | New migration: cancelled status, columns |
| `src/app/services/activityLogService.ts` | Ensure cancel actions logged |

---

## SUMMARY

| Current Issue | Fix |
|---------------|-----|
| Final sales/purchases hard deleted | Cancel only (status + reverse) |
| Ledger entries deleted | Create reverse entries |
| Journal entries deleted | Create reverse entries |
| Activity logs deleted | Never delete; log cancel |
| No cancel reason | Mandatory reason field |
| No user tracking | cancelled_by, timestamp |
| Invoice reuse | Already OK (document_sequences) |

**Next step:** Implement Phase 1 in Web app, then validate, then port to Mobile.

---

## IMPLEMENTATION COMPLETED (Phase 1)

**Date:** February 2026

### What was implemented

1. **Migration `46_sale_purchase_cancel_columns.sql`**
   - Added `cancelled` to `sale_status` and `purchase_status` enums
   - Added `cancelled_at`, `cancelled_by`, `cancel_reason` to sales and purchases
   - Added `cancel_reason` to expenses

2. **`cancellationService.ts`**
   - `cancelSale(id, options)` – validates final, no returns, then calls saleService.cancelSale
   - `cancelPurchase(id, options)` – validates non-draft, then calls purchaseService.cancelPurchase
   - `cancelExpense(id, options, companyId)` – soft delete with reason + activity log

3. **saleService**
   - `deleteSale` – only for draft/quotation/order; throws for final
   - `cancelSale` – for final; reverses stock/ledger/journal, sets status=cancelled, logs activity
   - `deleteSaleCascade` – shared internal logic

4. **purchaseService**
   - `deletePurchase` – only for draft; throws for ordered/received/final
   - `cancelPurchase` – for non-draft; same reversal flow
   - `deletePurchaseCascade` – shared internal logic

5. **SalesContext + SalesPage**
   - `cancelSale(id, reason)` added
   - Final sales: "Cancel Invoice" → modal with required reason
   - Draft: "Delete" → existing delete flow

6. **PurchaseContext + PurchasesPage**
   - `cancelPurchase(id, reason)` added
   - Draft: "Delete"; others: "Cancel PO" → modal with required reason

7. **expenseService**
   - `deleteExpense` now accepts optional `{ reason, performedBy }`
   - Sets `cancel_reason`, logs `expense_cancelled` activity

### Run migration

```bash
npm run dev
# Or apply manually: supabase-extract/migrations/46_sale_purchase_cancel_columns.sql
```
