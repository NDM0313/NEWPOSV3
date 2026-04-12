# FINAL: Sale Return Engine — Historic Audit & Full Repair Closure

**Date:** 2026-04-12  
**Scope:** All sale + sale return paths — code audit, DB audit, live repair  
**Builds on:**
- [FINAL_SALE_ENGINE_AND_MANUAL_SALE_RETURN_STANDARDIZATION_CLOSURE.md](./FINAL_SALE_ENGINE_AND_MANUAL_SALE_RETURN_STANDARDIZATION_CLOSURE.md)
- [FINAL_SALE_RETURN_PARTIAL_VALUE_AND_TERMINAL_CANCEL_CLOSURE.md](./FINAL_SALE_RETURN_PARTIAL_VALUE_AND_TERMINAL_CANCEL_CLOSURE.md)
**Status:** ALL PATHS FIXED — code local, DB live, 6 repairs executed

---

## 1. Phase 1 — Root Cause Audit

### A. Normal Sale Finalization

**Entry point:** `saleService.updateSaleStatus(id, 'final')` → calls `postSaleDocumentAccounting(saleId)` from `documentPostingEngine.ts`.

**JE creator:** `saleAccountingService.createSaleJournalEntry()` — the ONLY function that creates the canonical sale document JE.

**GL posting standard:**
```
Dr Accounts Receivable (1100)     = invoice total
Dr Discount Allowed (5200)        = discount [if any]
  Cr Sales Revenue (4000/4100)    = gross revenue - shipping
  Cr Shipping Income (4110)       = shipping [if any]
  Dr COGS (5000)                  = Σ(qty × cost_price) from sale items
  Cr Inventory (1200)             = same amount
```

**Idempotent:** YES — `action_fingerprint = saleDocumentJournalFingerprint(companyId, saleId)`, checked before insert.

**Cancellation:** `reverseSaleDocumentAccounting(saleId)` → `saleAccountingService.reverseSaleJournalEntry()` — posts `reference_type='sale_reversal'`, full inverse.

---

### B. Linked Sale Return

**Two JEs required. Two separate call chains.**

#### Chain 1 — Inventory/COGS Reversal
**Caller:** `finalizeSaleReturn()` in `saleReturnService.ts`  
**Function:** `saleAccountingService.createSaleReturnInventoryReversalJE()`  
**GL posting:**
```
Dr Inventory (1200)         = Σ canonicalSaleReturnStockEconomics.totalCost
Cr COGS (5000)              = same amount
reference_type: 'sale_return', reference_id: returnId
action_fingerprint: 'sale_return_cogs:<companyId>:<returnId>'
```
**Added in:** Task 1 (2026-04-12). Pre-fix, this JE never existed.

#### Chain 2 — Settlement JE
**Caller:** UI form after `finalizeSaleReturn` → `accounting.recordSaleReturn()` in `AccountingContext.tsx`  
**GL posting:**
```
Dr Sales Revenue (4000/4100)  = return selling amount (refreshed total)
Cr AR (1100) / Cash / Bank    = based on refundMethod
reference_type: 'sale_return', reference_id: returnId
action_fingerprint: 'sale_return_settlement:<companyId>:<returnId>'
```
**`action_fingerprint` added in:** Task 2 (2026-04-12). Pre-fix, fingerprint was missing → duplicate risk on retry.

**For SaleReturnForm.tsx:** `refundAccountId` was hardcoded `null` — fixed in Task 2 to use `selectedRefundAccountId`.

---

### C. Manual Sale Return (No Invoice)

**Form:** `StandaloneSaleReturnForm.tsx` — same `finalizeSaleReturn` + `accounting.recordSaleReturn` call chain.  
**Settlement modes:** Cash / Bank / Adjust-in-account (customer AR).  
**No supplier semantics — correct as-is.**  
`selectedRefundAccountId` was already implemented correctly in this form.

---

### D. Journal Safety

**`resolveUnifiedJournalEdit()` in `unifiedTransactionEdit.ts` blocks:**
- `reference_type = 'sale_return'` → `kind: 'blocked'` — "Return postings are source-controlled. Cancel or void the return from Sales or Purchases."
- `reference_type` is `document_total` kind (sale rows without payment_id) → `kind: 'blocked'`

**`updateManualJournalEntry()` in `accountingService.ts` blocks:**
```typescript
if (rt !== 'journal') {
  return { ok: false, error: 'Only manual (journal) entries can be edited here; use Edit source for posted documents.' };
}
```

**`journalReversalBlockedReason()` in `journalEntryEditPolicy.ts` blocks:**
```typescript
SOURCE_CONTROLLED_REFERENCE_TYPES = ['sale', 'sale_return', 'sale_adjustment', ...]
```

**Conclusion: No loophole exists.** Sale and sale_return JEs cannot be edited, reversed, or deleted from the Journal / Accounting page.

---

### E. Terminal Cancel / Void Idempotency

**`voidSaleReturn()` in `saleReturnService.ts`:**
```typescript
if (return.status === 'void') return { alreadyVoided: true }; // early exit, no mutations
```
- Status update `final → void` is an atomic CAS. Concurrent second call gets 0 rows affected → rollback.
- Stock reversal (`sale_return_void` movements) has dedup check before insert.
- All `reference_type='sale_return'` JEs are reversed via `createReversalEntry`.

**Conclusion: Void is fully idempotent and terminal.**

---

### F. Partial Return Value Consistency

**`canonicalSaleReturnStockEconomics()` formula:**
```typescript
// Linked return (has original line):
totalCost = isFull ? origLineTotal : roundMoney2((returnQty / origQty) * origLineTotal)

// Standalone return (no original):
totalCost = qty * unit_price OR stored total
```
Partial returns only charge the returned fraction of cost. Full returns use the exact original line total to avoid float accumulation.

---

## 2. Phase 3 — Historic DB Audit Results

**DB queried:** `docker exec supabase-db psql -U postgres -d postgres`  
**Total returns in DB:** 6 (as of 2026-04-12)

| Return | Company | Status | Total | Type | Settlement JE | Inventory JE | Stock Net | Issues Found |
|--------|---------|--------|-------|------|---------------|--------------|-----------|--------------|
| RET-20260307-5856 | eb71d817 | final | 44,820 | linked | JE-8261 (WRONG ref_id) | MISSING | +16 | (1) reference_id was sale_id not return_id; (2) no inventory JE; (3) no fingerprint |
| RET-20260411-9519 | 595c08c2 | **final (bug)** | 40,926 | linked | JE-0099 (WRONG ref_id, ACTIVE) | MISSING | **0 (voided)** | Zombie: stock voided, status not updated, settlement JE active |
| RET-20260411-3748 | 595c08c2 | void | 13,500 | linked | JE-0100 (WRONG accounts, NOT VOID) | none | 0 ✓ | JE-0100 had Dr Rental Income (4200) instead of Dr Sales Revenue — was not voided |
| RET-20260412-5650 | 595c08c2 | final | 124,800 | linked | JE-0108 (correct, no fingerprint) | MISSING | +4 ✓ | Missing inventory JE; no fingerprint on settlement |
| RET-20260412-3776 | 595c08c2 | final | 249,600 | standalone | JE-0110 (correct, no fingerprint) | MISSING | +8 ✓ | Missing inventory JE; no fingerprint on settlement |
| RET-20260412-7426 | 595c08c2 | final | 3,750 | linked | JE-0113 (correct, no fingerprint) | MISSING | +5 ✓ | Missing inventory JE; no fingerprint on settlement |

---

## 3. Phase 4 — Live DB Repairs Executed

All repairs wrapped in `BEGIN; ... COMMIT;` transactions with per-block verification.

### Repair 1 — Void JE-0100 (wrong accounts on void return)
**Target:** `c78fed70-fbca-4d14-9eef-fbf5a8fef95c`  
**Action:** `UPDATE journal_entries SET is_void=TRUE WHERE id='c78fed70...'`  
**Result:** `UPDATE 1` — JE voided.  
**Reason:** JE had Dr Rental Income (4200) — completely wrong account. The return was already `void` but this JE was left active. Voiding it preserves audit trail while stopping GL leakage.

### Repair 2 — Fix JE-8261 reference_id + backfill fingerprint (RET-5856)
**Target:** `1b66e07b-c7a5-46fe-a806-cfdcfa968279`  
**Action:**
```sql
UPDATE journal_entries
SET reference_id = '76fa8f3b-f039-4ac7-84e6-3a68e4bf5816',  -- return_id (was sale_id)
    action_fingerprint = 'sale_return_settlement:eb71d817...:76fa8f3b...'
WHERE id = '1b66e07b...';
```
**Result:** `UPDATE 1` — reference_id and fingerprint corrected.  
**Why metadata-only fix (not void+repost):** The accounting numbers (Dr Sales Revenue / Cr AR) were correct. Only the linking field (reference_id) pointed to the wrong record. Changing reference_id does not affect any debit/credit amounts; it only ensures `voidSaleReturn` can find and reverse this JE when needed.

### Repair 3 — Backfill fingerprints on 3 settlement JEs (595c08c2 company)
**Targets:** JE-0108, JE-0110, JE-0113  
**Action:**
```sql
UPDATE journal_entries SET action_fingerprint = 'sale_return_settlement:<companyId>:<returnId>'
WHERE id IN (...3 IDs...) AND action_fingerprint IS NULL;
```
**Result:** `UPDATE 1` × 3  
**Why:** These JEs were created before the fingerprint fix. Backfilling ensures retry-dedup works for any future re-submissions.

### Repair 4 — Post missing inventory reversal JEs (company 595c08c2)
Three returns required `Dr Inventory (1200) / Cr COGS (5000)`:

| Return | Amount | New JE ID | Entry No | Balance |
|--------|--------|-----------|----------|---------|
| RET-20260412-5650 | 124,800 | 8a857aa5 | JE-0114 | BALANCED |
| RET-20260412-3776 | 249,600 | 3eb30e84 | JE-0115 | BALANCED |
| RET-20260412-7426 | 3,750 | 76f284f5 | JE-0116 | BALANCED |

Account IDs used: Inventory `11b3f44c`, COGS `77fb9ba7` (company 595c08c2).  
Fingerprints: `sale_return_cogs:595c08c2-...:970b5730-...` etc.  
> Note: DB trigger auto-assigned entry_no (JE-0114/0115/0116). `entry_no` requested as `JE-RTN-INV-REPAIR-...` was overridden. UUIDs and fingerprints are the correct identifiers.

### Repair 5 — Post missing inventory reversal JE (company eb71d817)
**Return:** RET-20260307-5856 (44,820)  
**New JE ID:** b8d48850 / Entry No: JE-8541  
Account IDs: Inventory `06c9f655`, COGS `79c757d6` (company eb71d817).  
Fingerprint: `sale_return_cogs:eb71d817-...:76fa8f3b-...`  
Result: BALANCED

### Repair 6 — Handle zombie return RET-20260411-9519
**State discovered:** `final` status but stock net = 0 (both `sale_return` and `sale_return_void` movements existed). Settlement JE (JE-0099) was active, pointing to sale_id instead of return_id.

**Actions:**
1. Fixed JE-0099 `reference_id` → return_id (`6a56cccb`)
2. Voided JE-0099 (settlement credit already effectively reversed by stock void)
3. Updated return status `final` → `void` (matches stock reality)

**Rationale:** Since the stock movement was physically undone (return + void), the accounting should reflect void state. The customer's AR credit from JE-0099 was voided to match. This is consistent: no stock in/out, no revenue reversal.

---

## 4. Phase 3 — Post-Repair Verification Results

**Query run 2026-04-12 immediately after all repairs:**

```
return_no          | status | stock_cost | gl_inv_dr | reconciliation
-------------------+--------+------------+-----------+---------------
RET-20260307-5856  | final  |   44820.00 |  44820.00 | MATCH
RET-20260411-9519  | void   |   40926.00 |         0 | VOID-OK
RET-20260411-3748  | void   |   13500.00 |         0 | VOID-OK
RET-20260412-5650  | final  |  124800.00 | 124800.00 | MATCH
RET-20260412-3776  | final  |  249600.00 | 249600.00 | MATCH
RET-20260412-7426  | final  |    3750.00 |   3750.00 | MATCH
```

- All 4 final returns: `settlement_je_count = 1`, `inventory_je_count = 1`, `MATCH`
- Both void returns: `settlement_je_count = 0`, `inventory_je_count = 0`, `VOID-OK`
- Zero duplicate JEs
- Zero unbalanced JEs
- Zero wrong credit routing

---

## 5. Phase 2 — Accounting Standards Enforced

### Sale Finalization
```
Dr AR (1100)                = total
Dr Discount Allowed (5200)  = discount [if any]
  Cr Sales Revenue          = gross - shipping
  Cr Shipping Income (4110) = shipping [if any]
Dr COGS (5000)              = Σ cost
  Cr Inventory (1200)       = same
```

### Sale Return (both JEs required)
Settlement:
```
Dr Sales Revenue            = return selling amount
  Cr AR (1100)              [adjust] — customer party subledger if available
  Cr Cash (1000)            [cash refund]
  Cr Bank (1010)            [bank refund]
action_fingerprint: 'sale_return_settlement:<co>:<returnId>'
```
Inventory:
```
Dr Inventory (1200)         = return cost basis (canonical economics)
  Cr COGS (5000)            = same
action_fingerprint: 'sale_return_cogs:<co>:<returnId>'
```
Both: `reference_type='sale_return'`, `reference_id=returnId`.

### Sale Cancellation (Reversal)
Full inverse of sale JE. `reference_type='sale_reversal'`, `reference_id=saleId`.

---

## 6. Phase 5 — Source-Owned Journal Policy (Proved)

**Three independent code-level locks prevent any direct edit/reverse of sale or sale_return JEs from the Accounting/Journal page:**

| Gate | Location | Condition | Effect |
|------|----------|-----------|--------|
| `resolveUnifiedJournalEdit` | `unifiedTransactionEdit.ts:150-156` | `rt === 'sale_return'` | Returns `{ kind: 'blocked' }` |
| `updateManualJournalEntry` | `accountingService.ts:3336-3339` | `rt !== 'journal'` | Returns `{ ok: false, error: '...' }` |
| `journalReversalBlockedReason` | `journalEntryEditPolicy.ts:140-147` | `SOURCE_CONTROLLED_REFERENCE_TYPES.has(rt)` | Returns block reason string |

**No loophole found.** All three gates independently enforce the policy. The only permitted path for reversing a sale_return JE is via `voidSaleReturn` in the sales module.

---

## 7. Phase 6 — Test Evidence

### TEST 1 — Normal sale (proven by existing DB data)
All active sales in DB have JEs with DR AR + DR COGS + CR Revenue + CR Inventory. Verified via CHECK 2 in `verify_sale_and_manual_sale_return_standardization.sql`.

### TEST 2 — Linked sale return partial (RET-20260412-7426)
Return for 5 units (Salar), linked to SL-0006:
- Stock: +5 qty, cost 3,750 ✓
- Settlement JE: Dr Sales Revenue 3,750 / Cr AR-Salar 3,750 ✓
- Inventory JE (repaired): Dr Inventory 3,750 / Cr COGS 3,750 ✓
- Both JEs balanced, correct reference_id, fingerprints set

### TEST 3 — Manual sale return no invoice (RET-20260412-3776)
Standalone return for Nabeel (no original_sale_id):
- Stock: +8 qty, cost 249,600 ✓
- No supplier semantics ✓
- Settlement JE: Dr Sales Revenue / Cr AR-Nabeel (adjust mode) ✓
- Inventory JE (repaired): Dr Inventory / Cr COGS ✓

### TEST 4 — Adjust in account
RET-20260412-3776 and RET-20260412-7426 both use adjust mode.
Settlement JE credits party subledger (AR-Nabeel, AR-Salar). Customer balance reduced, no cash/bank movement. ✓

### TEST 5 — Cash refund (RET-20260412-5650)
Settlement JE: Dr Sales Revenue 124,800 / Cr Cash 124,800.
Cash account directly credited (not AR). ✓

### TEST 7 — Cancel once / terminal idempotency (RET-20260411-9519 & RET-20260411-3748)
Both returns void with net-zero stock and no active accounting JEs.
`voidSaleReturn` early return `{ alreadyVoided: true }` on second call — no duplicate JEs possible. ✓

### TEST 8 — Journal safety
`resolveUnifiedJournalEdit` + `updateManualJournalEntry` + `journalReversalBlockedReason` all block sale/sale_return edits. Proved in Phase 5 above. ✓

### TEST 9 — Historic repair verification
All 4 final returns now show `MATCH` in stock vs GL reconciliation (Section 4 above). ✓

---

## 8. Code Changes Summary (Local Only — Not Deployed)

| File | Change | Task |
|------|--------|------|
| `src/app/services/saleAccountingService.ts` | Added `createSaleReturnInventoryReversalJE()` | Task 1 |
| `src/app/services/saleReturnService.ts` | Added inventory cost accumulation + JE call in `finalizeSaleReturn` | Task 1 |
| `src/app/context/AccountingContext.tsx` | Added `action_fingerprint` to both JE build paths for `Sale_Return` source | Task 2 |
| `src/app/components/sales/SaleReturnForm.tsx` | Added account selector, fixed `refundAccountId: null` | Task 2 |

**Build:** `npm run build` → ✓ 0 errors (confirmed both Task 1 and Task 2).

---

## 9. DB Repairs Summary (Live — Executed 2026-04-12)

| Repair | Target | Action | Result |
|--------|--------|--------|--------|
| R1 | JE c78fed70 (JE-0100) | Voided (wrong accounts on void return) | UPDATE 1 |
| R2 | JE 1b66e07b (JE-8261) | Fixed reference_id + backfilled fingerprint | UPDATE 1 |
| R3 | JE-0108, JE-0110, JE-0113 | Backfilled action_fingerprint | UPDATE 1 × 3 |
| R4a | RET-5650 (970b5730) | Posted Dr Inv 124,800 / Cr COGS 124,800 | JE-0114 BALANCED |
| R4b | RET-3776 (a42aea11) | Posted Dr Inv 249,600 / Cr COGS 249,600 | JE-0115 BALANCED |
| R4c | RET-7426 (fe125486) | Posted Dr Inv 3,750 / Cr COGS 3,750 | JE-0116 BALANCED |
| R5 | RET-5856 (76fa8f3b) | Posted Dr Inv 44,820 / Cr COGS 44,820 | JE-8541 BALANCED |
| R6 | RET-9519 (6a56cccb) | Fixed ref_id, voided JE-0099, status → void | 3× UPDATE 1 |

**No hard deletes. All changes auditable and reversible.**

---

## 10. Idempotency Coverage Summary

| Operation | Fingerprint | State |
|-----------|-------------|-------|
| Sale document JE | `saleDocumentJournalFingerprint(co, saleId)` | Always set |
| Sale return inventory JE | `sale_return_cogs:<co>:<returnId>` | Always set (Task 1) |
| Sale return settlement JE | `sale_return_settlement:<co>:<returnId>` | Always set (Task 2) + backfilled on historic |
| `voidSaleReturn` | CAS status `final→void` | Terminal + early return if already void |

---

## 11. Files Changed / Created

**Code (local):**
- `src/app/services/saleAccountingService.ts`
- `src/app/services/saleReturnService.ts`
- `src/app/context/AccountingContext.tsx`
- `src/app/components/sales/SaleReturnForm.tsx`

**SQL (local + DB-executed):**
- `scripts/verify_sale_and_manual_sale_return_standardization.sql` — original 7-check read-only audit
- `scripts/repair_sale_and_manual_sale_return_live_cases.sql` — original repair playbook
- `scripts/verify_all_sale_return_engine_consistency.sql` — comprehensive 7-check audit (updated with actual DB run results)
- `scripts/repair_all_sale_return_engine_live_cases.sql` — comprehensive repair playbook (all blocks executed)
- `scripts/verify_sale_source_owned_terminal_locking.sql` — source-owned + terminal locking checks
