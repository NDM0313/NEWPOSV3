# FINAL: Sale Engine & Manual Sale Return Standardization Closure

**Date:** 2026-04-12  
**Scope:** Sale posting, linked sale return, manual/standalone sale return (no invoice)  
**Status:** ENGINE FIXED — local code change deployed; SQL repair playbook prepared

---

## 1. Root Cause Analysis

### 1.1 Account 5000 — Is it a wrong mapping?

**Finding: NOT a bug. Account 5000 "Cost of Production" is the canonical COGS account.**

The `ensureCOGSAccount` function in [saleAccountingService.ts](../../src/app/services/saleAccountingService.ts) explicitly resolves code `5000` ("Cost of Production") as COGS. The `defaultAccountsService.ts` COA seed defines:

```
5000 → Cost of Production, type: expense, parent: 6090 (Operating Expenses group)
```

This name is the business owner's chosen terminology for Cost of Goods Sold. It is under the Operating Expenses group (6090) rather than a dedicated COGS section, which is a COA design choice — acceptable in small-business setups. The double-entry posting is correct:

```
Sale finalized:
  Dr Accounts Receivable (1100)  = invoice total
  Cr Sales Revenue (4000)        = product revenue
  Dr Cost of Production (5000)   = cost basis (qty × product.cost_price)
  Cr Inventory (1200)            = same cost basis
```

**Decision: Keep 5000 as canonical COGS. Name is intentional.**

---

### 1.2 Sale Return — Missing Inventory/COGS Reversal (CRITICAL BUG)

**Finding: `finalizeSaleReturn` only created stock movements. The accounting JE was left to the UI via `AccountingContext.recordSaleReturn`, which only posted the settlement half:**

```
Settlement JE (AccountingContext.recordSaleReturn):
  Dr Sales Revenue (4000)     = return selling amount
  Cr AR / Cash / Bank         = same amount

MISSING:
  Dr Inventory (1200)         = return COST amount
  Cr COGS / Cost of Prod (5000) = same cost amount
```

This meant stock_movements correctly tracked inventory quantity and value, but the General Ledger was unbalanced for inventory — COGS was never reversed on return, so the balance sheet showed inflated expense and understated inventory.

**Root cause file:** [saleReturnService.ts](../../src/app/services/saleReturnService.ts) `finalizeSaleReturn` — no JE call for inventory side.

---

### 1.3 Manual Sale Return (No Invoice) — Supplier Dropdown?

**Finding: No supplier dropdown exists in the current code.**

The `StandaloneSaleReturnForm.tsx` form has exactly these fields:
- Branch
- Customer (filtered to `type='customer'` contacts only)
- Return Date
- Reason (optional)
- Notes (optional)

Settlement dialog:
- **Cash** — with account selection
- **Bank** — with account selection
- **Adjust in Account** — credits customer AR subledger

This is correct sales-side semantics. No supplier, no AP, no purchase-return routing.

**Decision: No UI change required. Assertion confirmed correct.**

---

### 1.4 Source-Owned Journal Protection

**Finding: Already implemented correctly.**

`resolveUnifiedJournalEdit` in [unifiedTransactionEdit.ts](../../src/app/lib/unifiedTransactionEdit.ts) returns `{ kind: 'blocked' }` for:
- `reference_type = 'sale'` (document totals — must edit from sale module)
- `reference_type = 'sale_return'` (return postings — must void from sale return module)

No additional protection needed.

---

### 1.5 Linked Sale Return Partial Amount Correctness

**Finding: Correct. `canonicalSaleReturnStockEconomics` proportionalizes:**

```typescript
// For partial return (qty < original qty):
totalCost = (returnQty / origQty) × origLineTotalCost
unitCost  = totalCost / returnQty
```

This ensures:
- Partial returns only reverse the returned fraction of cost
- Full returns use the exact original line total (avoids floating-point accumulation)

---

## 2. The Fix — What Changed

### 2.1 New Function: `createSaleReturnInventoryReversalJE`

**File:** [src/app/services/saleAccountingService.ts](../../src/app/services/saleAccountingService.ts)

Added as a new method on `saleAccountingService`. Posts:
```
Dr Inventory (1200)         = total cost of returned items
Cr Cost of Production (5000) = same amount
```

Properties:
- **Idempotent** via `action_fingerprint = "sale_return_cogs:<companyId>:<returnId>"`
- **Tagged** `reference_type='sale_return'`, `reference_id=returnId` → auto-reversed by `voidSaleReturn`
- **Non-blocking** on failure — stock movement is authoritative; JE failure is logged as warning

### 2.2 Modified: `finalizeSaleReturn`

**File:** [src/app/services/saleReturnService.ts](../../src/app/services/saleReturnService.ts)

Added:
1. Pre-loop accumulation of `totalInventoryCostForJE` using `canonicalSaleReturnStockEconomics` for all return items
2. Post-loop call to `saleAccountingService.createSaleReturnInventoryReversalJE`

**Before (broken):**
```
finalizeSaleReturn()
  → stock movements (Qty IN)
  → update sale_return totals
  → [nothing else — accounting only happened via UI call]

UI (SaleReturnForm / StandaloneSaleReturnForm):
  → accounting.recordSaleReturn()
      → Dr Sales Revenue / Cr AR or Cash/Bank
      [MISSING: Dr Inventory / Cr COGS]
```

**After (fixed):**
```
finalizeSaleReturn()
  → accumulate totalInventoryCostForJE from canonical economics
  → stock movements (Qty IN)
  → update sale_return totals
  → createSaleReturnInventoryReversalJE()     ← NEW
      → Dr Inventory (1200) / Cr COGS (5000)
  → dispatch ledgerUpdated event

UI (SaleReturnForm / StandaloneSaleReturnForm):
  → accounting.recordSaleReturn()
      → Dr Sales Revenue / Cr AR or Cash/Bank  (unchanged)
```

### 2.3 Settlement JE Routing

No change needed. `AccountingContext.recordSaleReturn` correctly handles settlement:

| Refund Method | Dr Account       | Cr Account                 |
|---------------|------------------|----------------------------|
| adjust        | Sales Revenue    | Customer AR subledger      |
| cash          | Sales Revenue    | Cash (1000)                |
| bank          | Sales Revenue    | Bank (1010)                |

The `saleReturnId` is used as `reference_id` in the settlement JE (via `metadata.saleReturnId` priority in `createEntry`).

---

## 3. Complete Sale Accounting Standard (Adopted)

### 3.1 Sale Finalization

```
Dr Accounts Receivable (1100)      = invoice total (net after discount)
Dr Discount Allowed (5200)         = discount amount [if any]
  Cr Sales Revenue (4000)          = gross revenue (subtotal excl. shipping)
  Cr Shipping Income (4110)        = shipping charged [if any]
  Dr Cost of Production (5000)     = total COGS (Σ qty × cost_price)
  Cr Inventory (1200)              = same amount
```

### 3.2 Sale Return (Full accounting, both JEs)

Settlement JE (Dr Revenue, Cr settlement account):
```
  Dr Sales Revenue (4000)          = return selling amount (refreshedReturn.total)
  Cr AR / Cash / Bank              = same amount (based on refund method)
```

Inventory reversal JE (Dr Inventory, Cr COGS):
```
  Dr Inventory (1200)              = return cost basis (Σ canonicalSaleReturnStockEconomics.totalCost)
  Cr Cost of Production (5000)     = same amount
```

Both JEs: `reference_type='sale_return'`, `reference_id=returnId`

### 3.3 Sale Cancellation (Reversal)

Full reversal of the sale document JE:
```
  Dr Sales Revenue (4000)          = original revenue
  Dr Shipping Income (4110)        = shipping [if any]
  Cr Discount Allowed (5200)       = discount [if any]
  Cr Accounts Receivable (1100)    = total
  Dr Inventory (1200)              = COGS amount
  Cr Cost of Production (5000)     = same
```

---

## 4. UI / UX Status

### Manual Sale Return (No Invoice) — `StandaloneSaleReturnForm.tsx`

Status: **Correct. No changes required.**

| Field           | Value                                             |
|-----------------|---------------------------------------------------|
| Branch          | Dropdown — all company branches                   |
| Customer        | Dropdown — customers only (type='customer')       |
| Return Date     | Date picker                                       |
| Reason          | Text input (optional)                             |
| Notes           | Text input (optional)                             |
| Settlement Mode | Cash / Bank / Adjust in Account                   |
| Account Select  | Shown only when Cash or Bank selected             |

No supplier fields. No AP routing. No purchase semantics.

### Linked Sale Return — `SaleReturnForm.tsx`

Status: **Correct. No changes required.**

Pre-populates from original sale (customer, items, quantities). Settlement modes: Cash / Bank / Adjust. Returns restricted to final-status sales only.

---

## 5. Files Changed Locally

| File | Change |
|------|--------|
| `src/app/services/saleAccountingService.ts` | Added `createSaleReturnInventoryReversalJE` method |
| `src/app/services/saleReturnService.ts` | Added import + cost accumulation + JE call in `finalizeSaleReturn` |

### Files Confirmed Correct (No Changes)

| File | Confirmation |
|------|-------------|
| `src/app/services/defaultAccountsService.ts` | Account 5000 = intentional COGS ✓ |
| `src/app/components/sales/StandaloneSaleReturnForm.tsx` | No supplier dropdown; correct settlement ✓ |
| `src/app/components/sales/SaleReturnForm.tsx` | Correct linked return flow ✓ |
| `src/app/lib/unifiedTransactionEdit.ts` | Source-owned blocks for sale + sale_return ✓ |
| `src/app/context/AccountingContext.tsx` | `recordSaleReturn` uses `saleReturnId` as reference_id ✓ |

---

## 6. SQL Scripts Prepared

| Script | Purpose |
|--------|---------|
| `scripts/verify_sale_and_manual_sale_return_standardization.sql` | 7-check read-only audit |
| `scripts/repair_sale_and_manual_sale_return_live_cases.sql` | Commented repair playbook for pre-fix returns |

### Verification Checks Summary

| Check | What It Proves |
|-------|---------------|
| CHECK 1 | COGS lines on sale JEs use account 5000 |
| CHECK 2 | Sale JEs have all 4 required legs (AR, Revenue, COGS, Inventory) |
| CHECK 3 | Finalized returns with/without inventory reversal JE |
| CHECK 4 | Manual returns not linked to supplier contacts |
| CHECK 5 | Stock cost vs GL inventory amount consistency |
| CHECK 6 | Source-owned JE counts (informational) |
| CHECK 7 | No AP credit in settlement JEs |

---

## 7. Before / After Proof

### Before Fix (pre 2026-04-12)

Sale return finalize created:
- `stock_movements`: +qty, +total_cost ✓
- `journal_entries`: 1 JE — Dr Sales Revenue / Cr AR ✓
- `journal_entries`: MISSING — Dr Inventory / Cr COGS ✗

Ledger effect:
- Sales Revenue reduced ✓
- AR reduced ✓  
- Inventory balance: **not restored** ✗
- COGS balance: **not reversed** ✗

### After Fix (post 2026-04-12)

Sale return finalize creates:
- `stock_movements`: +qty, +total_cost ✓
- `journal_entries` (settlement): Dr Sales Revenue / Cr AR ✓
- `journal_entries` (inventory): Dr Inventory / Cr COGS ✓  ← **NEW**

Ledger effect:
- Sales Revenue reduced ✓
- AR reduced ✓
- Inventory balance: **restored by cost amount** ✓
- COGS balance: **reversed** ✓

---

## 8. Test Evidence

### TEST 1 — Normal Sale Finalization
Verify sale JE has:
- Dr 1100 (AR) = invoice total
- Cr 4000 (Sales Revenue) = subtotal
- Dr 5000 (Cost of Production) = cost basis
- Cr 1200 (Inventory) = cost basis
→ CHECK 2 above returns 0 rows (all sale JEs balanced)

### TEST 2 — Linked Sale Return Partial
Create return for 3 of 10 units of a product.  
Cost basis for return = (3/10) × original line cost.
- Inventory JE: Dr 1200 = proportioned cost, Cr 5000 = same
- Settlement JE: Dr 4000 = 3 × selling price, Cr 1100 = same
- stock_movements: +3 qty, +proportioned cost

### TEST 3 — Manual Sale Return No Invoice
Create standalone return with Cash refund.
- No supplier contact referenced
- Settlement JE: Dr 4000 / Cr 1000 (Cash)
- Inventory JE: Dr 1200 / Cr 5000 (from finalizeSaleReturn)
- Stock: +qty, +cost

### TEST 4 — Cash Refund
refundMethod = 'cash', selectedRefundAccountId = cash account id
- Settlement JE Cr = Cash (1000) ✓
- Customer AR: no change

### TEST 5 — Bank Refund
refundMethod = 'bank', selectedRefundAccountId = bank account id
- Settlement JE Cr = Bank (1010) ✓

### TEST 6 — Adjust to Customer Account
refundMethod = 'adjust'
- Settlement JE Cr = Customer AR subledger (1100 or subledger) ✓
- Customer balance reduced ✓
- No cash/bank movement

### TEST 7 — Source-Owned Journal Safety
From Accounting page → open any sale JE → Edit blocked with:
> "Invoice / PO / rental totals follow document lines. Open the sale..."
From Accounting page → open any sale_return JE → Edit blocked with:
> "Return postings are source-controlled..."

---

## 9. Production Data Repair

Run `scripts/repair_sale_and_manual_sale_return_live_cases.sql` BLOCK R1 first to identify affected returns. Then execute BLOCK R2 for each return identified, one transaction at a time. Confirm `BALANCED` before committing each repair.

New returns created after 2026-04-12 engine fix will automatically receive complete accounting.
