# 26. Canonical Write Paths

**Date:** 2026-04-12  
**Purpose:** Per-domain map of which service function writes where, fingerprint format, and idempotency contract.  
**Source:** Read from actual service files (not assumed).

---

## How to Read This Document

Each section lists:
- **Service file** — the TypeScript file that owns the write
- **Function** — the specific function that posts the write
- **Tables written** — which DB tables are mutated
- **JE fingerprint** — the `action_fingerprint` used for idempotency (if any)
- **Idempotency guard** — how duplicate writes are prevented

---

## 1. Sales Engine

### Sale Create / Finalize

**Service:** `src/app/services/saleService.ts`  
**Function:** `finalizeSale()` (called from `SalesContext.tsx`)  
**Tables:**
- `sales` — status → `final`
- `stock_movements` — movement_type: `sale`, quantity negative
- `journal_entries` + `journal_entry_lines` (via `saleAccountingService`)

**JE fingerprints:**
- Settlement: `sale_document:{companyId}:{saleId}` — Dr Revenue (4100) / Cr AR subledger or Cash
- Inventory: `sale_stock:{companyId}:{saleId}` — Dr COGS (5000) / Cr Inventory (1200)

**Idempotency:** Fingerprint UNIQUE partial index (`WHERE action_fingerprint IS NOT NULL AND NOT is_void`). If fingerprint exists, posting is skipped.

**Note:** JE posting from `saleAccountingService` is fire-and-forget in some paths (non-awaited). This is a known gap — see doc 06.

---

### Sale Return Finalize

**Service:** `src/app/services/saleReturnService.ts`  
**Function:** `finalizeSaleReturn()`  
**Tables:**
- `sale_returns` — status → `final`
- `sale_return_items` — line totals
- `stock_movements` — movement_type: `sale_return`, quantity positive (stock back in)
- `journal_entries` + `journal_entry_lines`

**JE fingerprints:**
- Settlement: `sale_return_settlement:{companyId}:{returnId}` — Dr Revenue (4100) / Cr AR subledger or Cash or Bank
- Inventory: `sale_return_cogs:{companyId}:{returnId}` — Dr Inventory (1200) / Cr COGS (5000)

**Discount propagation (fixed 2026-04-12):**
`SaleReturnForm.tsx` useEffect computes proportional discount:
`returnDiscount = sale.discount_amount × (returnSubtotal / sale.subtotal)`

---

## 2. Purchase Engine

### Purchase Create / Finalize

**Service:** `src/app/services/purchaseAccountingService.ts`  
**Function:** `createPurchaseJournalEntry()`  
**Tables:**
- `purchases` — status progression (PDR → POR → PUR → final)
- `purchase_items` — line items
- `stock_movements` — movement_type: `purchase`, quantity positive
- `journal_entries` + `journal_entry_lines`

**JE fingerprint:** `purchase_document:{companyId}:{purchaseId}` — Dr Inventory (1200) / Cr AP subledger or 2000  
**AP resolution:** `resolvePayablePostingAccountId(companyId, supplierId)` → party subledger or fallback to code 2000

---

### Purchase Return Finalize (P1-1 PATCHED 2026-04-12)

**Service:** `src/app/services/purchaseReturnService.ts`  
**Function:** `finalizePurchaseReturn()`  
**Tables:**
- `purchase_returns` — status → `final`
- `purchase_return_items` — line items
- `stock_movements` — movement_type: `purchase_return`, quantity **negative** (stock OUT)
- `journal_entries` + `journal_entry_lines` ← **ADDED BY P1-1**

**JE fingerprint:** `purchase_return_settlement:{companyId}:{returnId}` — Dr AP subledger or 2000 / Cr Inventory (1200)  
**AP resolution:** `resolvePayablePostingAccountId(companyId, supplierId)` (imported from `partySubledgerAccountService`)  
**Inventory resolution:** `accounts` WHERE `code IN ('1200','1500') AND is_active = true`

**Before P1-1:** No JE was posted. AP subledger remained overstated.  
**After P1-1:** Canonical JE posted inside the `try` block, after stock movements loop, before event dispatch.

---

### Purchase Return Void

**Service:** `purchaseReturnService.ts`  
**Function:** `voidPurchaseReturn()`  
**JE handling:** Queries all active `reference_type='purchase_return'` JEs and calls `accountingService.createReversalEntry()` for each. Once P1-1 creates the finalize JE, void automatically reverses it. No void-path code change needed.

---

## 3. Payments Engine

### Payment Create

**Service:** `src/app/services/paymentLifecycleService.ts`  
**Function:** `createPayment()` / DB trigger  
**Tables:**
- `payments` — payment record
- `payment_allocations` — FIFO allocation (epsilon 0.02)
- `journal_entries` + `journal_entry_lines` — posted by DB trigger or `paymentLifecycleService`

**JE fingerprint:** `payment:{companyId}:{paymentId}`  
**Mutation guard:** `paymentChainMutationGuard.ts` — blocks edits to finalized payment chains

---

## 4. Inventory Engine

### Stock Movement Create

**Service:** `src/app/services/productService.ts`  
**Function:** `createStockMovement()`  
**Table:** `stock_movements`  
**Movement types:** `sale`, `sale_return`, `sale_return_void`, `purchase`, `purchase_return`, `purchase_return_void`, `adjustment`, `opening_stock`

All stock changes go through this function. Direct inserts to `stock_movements` without using this function are forbidden (no RLS bypass available).

---

## 5. Contacts / Party Subledger

### Contact Create

**Service:** `src/app/services/contactService.ts`  
**Function:** `createContact()`  
**Tables:** `contacts`  
**Important:** `current_balance` is trigger-maintained cache. Do NOT manually set it.

### Party Subledger Account Linking

**Service:** `src/app/services/partySubledgerAccountService.ts`  
**Functions:**
- `resolveReceivablePostingAccountId(companyId, contactId)` → AR-{slug} account id
- `resolvePayablePostingAccountId(companyId, contactId)` → AP-{slug} account id

**Account code format:** `AR-{contactId-slug}` and `AP-{contactId-slug}` (first 8 chars of contact UUID)

---

## 6. Document Numbering

### Canonical Path (use this)

**Service:** `src/app/services/documentNumberService.ts`  
**Function:** `getNextDocumentNumber(companyId, branchId, documentType)`  
**Table:** `erp_document_sequences`  
**RPC:** `generate_document_number`  
**Types:** `sale`, `purchase`, `payment`, `expense`, `journal`, `product`, `stock`, etc.

### Legacy Paths (phase out)

| Function | Table | Used by |
|----------|-------|---------|
| `getNextDocumentNumberGlobal()` | `document_sequences_global` | Some payment/receipt paths |
| `generateReturnNumber()` in purchaseReturnService.ts | `document_sequences` | Purchase return (patched by P1-4) |

---

## 7. Studio Engine

### Studio V1 — PRODUCTION BASELINE

**Service:** `src/app/services/studioProductionService.ts`  
**Write path for invoice lines:** `sales_items` (canonical) with fallback retry also to `sales_items` (P1-2 fix — fallback was `sale_items`)  
**Worker balance:** `worker_ledger_entries` table (read) + GL via `journal_entry_lines` (canonical truth)  
**Do NOT write:** `workers.current_balance` (removed by P1-3)

### Studio V2 — FROZEN

**Service:** `src/app/services/studioProductionV2Service.ts` (if exists)  
**Status:** Frozen. No new features. Sunset target: when all orders migrated to V1 or V3 (with JE layer).

### Studio V3 — BLOCKED (P1-5)

**Service:** `src/app/services/studioProductionV3Service.ts`  
**Function:** `completeStage()` — HARD BLOCKED until JE layer implemented  
**Reason:** `completeStage()` calls `updateStage()` only — no JE posted. Revenue recognised with no GL.  
**Unblock condition:** Implement purchase_return_settlement-style JE in V3 complete path.

---

## 8. Accounting Journal (Manual)

**Service:** `src/app/services/accountingService.ts`  
**Function:** `createEntry(entry: JournalEntry, lines: JournalEntryLine[])`  
**Guard:** Double-entry validation — `totalDebit` must equal `totalCredit` within 0.01  
**Tables:** `journal_entries` + `journal_entry_lines`  
**Note:** Do not pass `paymentId` for non-payment JEs (sale return, purchase return). `paymentId` links to Roznamcha — only pass for actual payment receipts.

---

## 9. Expenses

**Service:** `src/app/services/expenseService.ts`  
**JE fingerprint:** `expense_document:{companyId}:{expenseId}`  
**Mapping:** `CATEGORY_SLUG_TO_CODE` maps expense category slug to GL account code

---

## 10. Idempotency Reference Table

| Document | Fingerprint | Debit | Credit |
|----------|------------|-------|--------|
| Sale settlement | `sale_document:{co}:{id}` | Revenue 4100 | AR subledger or Cash 1000 |
| Sale inventory | `sale_stock:{co}:{id}` | COGS 5000 | Inventory 1200 |
| Sale return settlement | `sale_return_settlement:{co}:{id}` | Revenue 4100 | AR/Cash/Bank |
| Sale return inventory | `sale_return_cogs:{co}:{id}` | Inventory 1200 | COGS 5000 |
| Purchase | `purchase_document:{co}:{id}` | Inventory 1200 | AP subledger or 2000 |
| **Purchase return** | **`purchase_return_settlement:{co}:{id}`** | **AP subledger or 2000** | **Inventory 1200** |
| Payment | `payment:{co}:{id}` | Cash/Bank | AR subledger |
| Expense | `expense_document:{co}:{id}` | Expense acct | Cash/Bank |
| Opening stock | `opening_stock:{co}:{productId}` | Inventory 1200 | Equity 3000 |
