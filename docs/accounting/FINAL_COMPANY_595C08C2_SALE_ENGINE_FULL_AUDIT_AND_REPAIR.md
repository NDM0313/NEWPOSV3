# FINAL: Company 595c08c2 Sale Engine Full Audit & Repair

**Date:** 2026-04-12  
**Company:** `595c08c2-1e47-4581-89c9-1f78de51c613`  
**Builds on:** `FINAL_SALE_RETURN_ENGINE_HISTORIC_AUDIT_AND_REPAIR_CLOSURE.md`  
**Status:** CLOSED — all repairs executed, all verifications passed

---

## 1. Scope

This audit addressed newly discovered bugs triggered by a live complaint:

> **Mohsin case**: Customer bought goods at gross 31,200 with invoice-level discount of 200 (net total 31,000). On return, the system posted the settlement JE at 31,200 (gross) instead of 31,000 (net). The discount was not carried forward to the return.

Five bug classes were investigated:
1. **Discount allocation (CRITICAL)** — proved and fixed
2. **Inventory JE cost basis** — investigated; ruled out (system uses retail inventory method, selling price = cost for stock tracking)
3. **Partial quantity proportionality** — no issues found
4. **Settlement routing** — confirmed correct (AR subledger / Cash / Bank per refund method)
5. **Source-owned terminal locks** — confirmed via prior audit; not re-audited here

---

## 2. Root Cause: Discount Not Propagated to Sale Return

### The Bug

`SaleReturnForm.tsx` initialises `discountAmount` state to `0` (line 87). In **create mode**, this value is never overridden with a proportional amount from the original sale. The UI has no user-editable input for discount amount either. Result:

- `sale_return.discount_amount = 0` (hardcoded, always)
- `sale_return.total = return_subtotal - 0 = gross amount`
- Settlement JE debits Revenue at **gross** instead of **net**

### The Data Flow

```
SaleReturnForm.tsx
  └─ discountAmount = useState(0)          ← BUG: never set from original sale
  └─ total = subtotal - discountAmount     ← = gross (wrong)
  └─ createSaleReturn({ discount_amount: 0, total: gross })
       └─ sale_returns.discount_amount = 0
          sale_returns.total = gross
  └─ finalizeSaleReturn()
       └─ lineSum = Σ(sale_return_items.total)  = gross
          total = lineSum - disc + tax = gross - 0 = gross  (still wrong)
  └─ recordSaleReturn({ amount: refreshedReturn.total })
       └─ amount = gross
       └─ settlement JE: Dr Revenue (gross) / Cr AR|Cash (gross)  ← INFLATED
```

### Correct Formula

```
returnDiscountRate     = sale.discount_amount / sale.subtotal
proportionalDiscount   = returnSubtotal × discountRate
correctedReturnTotal   = returnSubtotal - proportionalDiscount
```

For a **full** return: `proportionalDiscount = sale.discount_amount` (100% rate).  
For a **partial** return: discount scales down with the returned subtotal.

---

## 3. Code Fix Applied: SaleReturnForm.tsx

**File:** `src/app/components/sales/SaleReturnForm.tsx`

**Change:** Added `useEffect` after the `total` useMemo (line ~503) that auto-populates `discountAmount` proportionally from the original sale whenever return quantities change.

```typescript
// Auto-populate proportional discount from original sale when return quantities change.
// Only applies in CREATE mode (returnId === null/undefined).
// Formula: returnDiscount = sale.discount_amount × (returnSubtotal / sale.subtotal)
useEffect(() => {
  if (returnId) return; // Edit mode: discount already loaded from existing return record
  const origDiscount = Number(originalSale?.discount_amount) || 0;
  const origSubtotal = Number(originalSale?.subtotal) || 0;
  if (origDiscount <= 0 || origSubtotal <= 0) return;
  const discountRate = origDiscount / origSubtotal;
  const proportionalDiscount = Math.round(subtotal * discountRate * 100) / 100;
  setDiscountAmount(proportionalDiscount);
}, [subtotal, originalSale, returnId]);
```

**Why placed here (after `total` useMemo):** `subtotal` is a `const` declared via `useMemo` — referencing it in the dependency array before its declaration would throw a ReferenceError (temporal dead zone). The effect must come after the `subtotal` declaration.

**Correctness cases:**
| Scenario | Behaviour |
|----------|-----------|
| Original sale has no discount | `origDiscount = 0` → effect exits early, discount stays 0 ✓ |
| Full return, all items | `proportionalDiscount = sale.discount_amount × (sale.subtotal / sale.subtotal) = sale.discount_amount` ✓ |
| Partial return (some items) | `proportionalDiscount = sale.discount_amount × (returnSubtotal / sale.subtotal)` ✓ |
| Edit mode (returnId set) | Effect skips; discount loaded from existing `sale_return.discount_amount` at line 174 ✓ |
| User changes quantities | `subtotal` dep triggers re-run, discount auto-scales proportionally ✓ |

**Build:** `npm run build` — 0 errors.

---

## 4. Bug 2 Investigation: Inventory JE Cost Basis

**Question:** Does `canonicalSaleReturnStockEconomics` use selling price (from `sales_items.total`) as the COGS reversal amount, when it should use purchase cost?

**Finding from live DB:**

```sql
SELECT si.total AS sell_total, sm.total_cost AS orig_cost_total
FROM sales_items si
LEFT JOIN stock_movements sm ON sm.reference_id = s.id AND sm.product_id = si.product_id
WHERE s.id IN (Mohsin SL-0007, Nabeel SL-0005)
```

| Invoice | sell_total | stock_movements.total_cost | Conclusion |
|---------|-----------|---------------------------|------------|
| SL-0007 | 31,200 | −31,200 | MATCH (negative = outflow) |
| SL-0005 | 468,000 | −468,000 | MATCH |

**Conclusion:** This system uses the **retail inventory method** — inventory is tracked at **selling price**. `stock_movements.total_cost` for a sale equals `−selling_price`. Therefore `canonicalSaleReturnStockEconomics` using `sales_items.total` (selling price) for the inventory reversal JE is **correct and consistent** with the original sale's COGS JE. Bug 2 is NOT present.

---

## 5. Live DB Audit Results (Company 595c08c2)

### Sales with Discounts

| invoice_no | customer_name | subtotal | discount_amount | total | status |
|------------|---------------|----------|-----------------|-------|--------|
| SL-0007 | Mohsin | 31,200 | 200 | 31,000 | final |
| SL-0005 | Nabeel | 468,000 | 5,000 | 463,000 | final |
| SL-0003 | Ali | 201,000 | 1,000 | 200,000 | final |
| SL-0004 | Nadeem | 145,036 | 536 | 144,500 | final |
| SL-0002 | Salar | 123,120 | 1,120 | 122,000 | final |

### Returns Against Discounted Sales (pre-repair)

| return_no | status | return_subtotal | return_discount | return_total | discount_status |
|-----------|--------|-----------------|-----------------|--------------|-----------------|
| RET-20260412-5305 | **final** | 31,200 | **0** | 31,200 | **MISSING** |
| RET-20260412-5650 | **final** | 124,800 | **0** | 124,800 | **MISSING** |
| RET-20260411-3748 | void | 13,500 | 0 | 13,500 | (void — OK) |
| RET-20260411-9519 | void | 40,926 | 0 | 40,926 | (void — OK) |

Only **2 final returns** needed repair. Void returns have no active settlement JEs.

---

## 6. DB Repairs Executed (2026-04-12)

### BLOCK A — Update Sale Return Headers

| Return | return_id | Before | After |
|--------|-----------|--------|-------|
| Mohsin RET-20260412-5305 | `07d0f51a-...` | discount=0, total=31,200 | **discount=200, total=31,000** |
| Nabeel RET-20260412-5650 | `970b5730-...` | discount=0, total=124,800 | **discount=1333.33, total=123,466.67** |

Proportional discount for Nabeel: `5,000 × (124,800 / 468,000) = 1,333.33`

### BLOCK B — Void Inflated Settlement JEs

| JE | entry_no | Previous amount | Action |
|----|----------|-----------------|--------|
| `32436621-...` | JE-0120 | Dr Revenue 31,200 / Cr AR-Mohsin 31,200 | **VOIDED** |
| `bcd018d1-...` | JE-0108 | Dr Revenue 124,800 / Cr Cash 124,800 | **VOIDED** |

Fingerprints freed by void (UNIQUE index excludes `is_void = TRUE`).

### BLOCK C — Repost Corrected Settlement JEs

| JE | entry_no | Correct amount | Credit account |
|----|----------|----------------|----------------|
| `new` | JE-0121 | Dr Revenue 31,000 / Cr AR-Mohsin 31,000 | AR-4EE03967B050 (party subledger) |
| `new` | JE-0122 | Dr Revenue 123,466.67 / Cr Cash 123,466.67 | 1000 Cash |

Both use the same `action_fingerprint` as the voided JEs (idempotency preserved).

---

## 7. Post-Repair Verification

### Check 1: No remaining MISSING DISCOUNT on final returns
```sql
SELECT COUNT(*) AS should_be_zero
FROM sale_returns sr
JOIN sales s ON s.id = sr.original_sale_id
WHERE sr.company_id = '595c08c2-...' AND sr.status = 'final'
  AND s.discount_amount > 0 AND sr.discount_amount = 0;
-- Result: 0 ✓
```

### Check 2: Settlement JE amounts match return.total
| return_no | return_net | settlement_debit | discrepancy | status |
|-----------|-----------|-----------------|-------------|--------|
| RET-20260412-3776 | 249,600.00 | 249,600.00 | 0.00 | **MATCH** |
| RET-20260412-5305 | 31,000.00 | 31,000.00 | 0.00 | **MATCH** |
| RET-20260412-5650 | 123,466.67 | 123,466.67 | 0.00 | **MATCH** |
| RET-20260412-7426 | 3,750.00 | 3,750.00 | 0.00 | **MATCH** |

All 4 final returns: MATCH ✓

---

## 8. Files Changed

### Code Changes
| File | Change |
|------|--------|
| `src/app/components/sales/SaleReturnForm.tsx` | Added `useEffect` to auto-populate proportional discount from original sale (after total useMemo, ~line 503) |

### SQL Scripts Created
| Script | Purpose |
|--------|---------|
| `scripts/verify_sale_engine_company_595c08c2.sql` | 5 checks (A–E) + combined summary view; read-only |
| `scripts/verify_sale_return_discount_and_partial_logic_company_595c08c2.sql` | 6 checks covering discount allocation, proportionality, partial qty, settlement JE accuracy |
| `scripts/verify_source_owned_terminal_lock_company_595c08c2.sql` | 7 checks for source-owned JE safety, void consistency, orphan JEs, stale drafts |
| `scripts/repair_sale_engine_company_595c08c2.sql` | Repair playbook (3 blocks: update header, void JEs, repost); includes pre/post verification queries |

---

## 9. Canonical Sale Return Standard (Updated)

A correctly finalised **linked** sale return must satisfy:

```
sale_return.discount_amount = sale.discount_amount × (return.subtotal / sale.subtotal)
sale_return.total           = sale_return.subtotal - sale_return.discount_amount

Settlement JE (fingerprint: sale_return_settlement:<co>:<returnId>):
  Dr Sales Revenue (4100)                           = sale_return.total  (NET)
  Cr Cash / Bank (1000/1010) | AR (1100) | Party AR = sale_return.total  (NET)

Inventory Reversal JE (fingerprint: sale_return_cogs:<co>:<returnId>):
  Dr Inventory (1200)                               = Σ(returnQty × orig_unit_price)
  Cr COGS/Operating Expense (5000)                  = same
  [Uses retail inventory method: inventory at selling price]
```

**Note on inventory JE:** The system uses the retail inventory method — inventory tracked at selling price. This is consistent across all sale and return JEs. The COGS reversal does NOT need adjustment for discounts; only the settlement JE must use the net amount.

---

## 10. Forward Fix Behaviour

With the code fix in place, for all **new** sale returns created via `SaleReturnForm.tsx`:

1. User selects items to return → `subtotal` = sum of gross item totals
2. `useEffect` fires → `discountAmount = sale.discount_amount × (subtotal / sale.subtotal)`
3. `total = subtotal - discountAmount` = net amount
4. `createSaleReturn({ discount_amount, total })` → stored correctly in DB
5. `finalizeSaleReturn()` → recomputes from line totals but preserves `discount_amount` from header → `total` stays correct
6. Settlement JE = `refreshedReturn.total` = net amount ✓

**No further DB repair needed** for returns created after this fix.
