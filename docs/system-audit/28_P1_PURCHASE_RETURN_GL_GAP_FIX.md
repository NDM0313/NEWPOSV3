# 28. P1-1: Purchase Return GL Gap Fix

**Date:** 2026-04-12  
**Status:** PATCHED — code fix applied; repair SQL created  
**Priority:** P1 — CRITICAL  
**Bug class:** Missing journal entry on document finalization

---

## 1. Problem Statement

Every finalized purchase return reduces supplier stock (goods returned to supplier = stock goes OUT). The AP liability should be reversed in the GL: **Dr AP subledger / Cr Inventory**.

Before this fix, `finalizePurchaseReturn()` in `src/app/services/purchaseReturnService.ts`:
- ✅ Created `stock_movements` rows (stock OUT, negative quantity)
- ✅ Updated `purchase_returns.status` → `final`
- ✅ Fired `ledgerUpdated` / `purchaseReturnsChanged` browser events
- ❌ **Posted NO journal entry** — AP subledger stayed overstated by the full return amount

---

## 2. Root Cause

`accountingService` was imported at line 7 but never called in `finalizePurchaseReturn()`. The function's try block (lines 271–338) contained only stock movement creation and RPC calls.

**Evidence:**
```
Lines 271–338 of purchaseReturnService.ts (pre-patch):
  - productService.createStockMovement(...) × N items   ✓
  - recalc_purchase_payment_totals RPC                  ✓
  - window.dispatchEvent(...)                           ✓
  - accountingService.createEntry(...)                  ✗ MISSING
```

---

## 3. Code Fix

**File:** `src/app/services/purchaseReturnService.ts`

### Import added (line 8)
```typescript
import { resolvePayablePostingAccountId } from './partySubledgerAccountService';
```

### JE block added (after stock movements loop, before `ledgerUpdated` dispatch)
```typescript
// ── P1-1: Post purchase return settlement JE (GL fix 2026-04-12) ──────────────
// Dr AP subledger (or 2000 fallback) / Cr Inventory (1200) = purchaseReturn.total
const prFingerprint = `purchase_return_settlement:${companyId}:${returnId}`;
const prSupplierId = purchaseReturn.supplier_id || originalPurchase?.supplier_id || null;
const prApAccountId = await resolvePayablePostingAccountId(companyId, prSupplierId || undefined)
  ?? (await supabase.from('accounts').select('id').eq(...code 2000...).maybeSingle()).data?.id ?? null;
const prInvAccountId = (await supabase.from('accounts').select('id').in('code', ['1200','1500'])...).data?.id ?? null;
const prReturnTotal = Number(purchaseReturn.total) || 0;
if (prReturnTotal > 0 && prApAccountId && prInvAccountId) {
  // Idempotency check: skip if fingerprint already exists
  const { data: existingPrJe } = await supabase.from('journal_entries')
    .select('id').eq('action_fingerprint', prFingerprint)
    .or('is_void.is.null,is_void.eq.false').maybeSingle();
  if (!existingPrJe) {
    await accountingService.createEntry(
      { company_id, branch_id, entry_date, description, reference_type: 'purchase_return',
        reference_id: returnId, action_fingerprint: prFingerprint, created_by: userId },
      [
        { account_id: prApAccountId, debit: prReturnTotal, credit: 0, description: 'Purchase Return — AP reversal' },
        { account_id: prInvAccountId, debit: 0, credit: prReturnTotal, description: 'Purchase Return — Inventory out' },
      ]
    );
  }
}
```

---

## 4. Void Path (no change needed)

`voidPurchaseReturn()` (lines 418–440) already:
1. Queries all active JEs with `reference_type='purchase_return'`
2. Calls `accountingService.createReversalEntry()` for each

Before P1-1: loop found 0 JEs (nothing to reverse). After P1-1: loop finds the settlement JE and posts a correct reversal. **No void-path code change required.**

---

## 5. JE Standard

```
reference_type   : 'purchase_return'
reference_id     : {returnId}
action_fingerprint: 'purchase_return_settlement:{companyId}:{returnId}'
is_void          : FALSE

Lines:
  Dr AP subledger (AP-{slug}) or code 2000   = return.total
  Cr Inventory (code 1200 or 1500)           = return.total
```

AP account resolution priority:
1. Party subledger via `resolvePayablePostingAccountId()` (returns `AP-{slug}` account id)
2. Fallback: account with `code = '2000'` for the company

Inventory account resolution:
- First match in `accounts` WHERE `code IN ('1200', '1500') AND is_active = TRUE`

---

## 6. Repair for Pre-Patch Data

Historical purchase returns that were finalized before this fix have no settlement JE.

**Repair script:** `scripts/repair_purchase_return_missing_journal_entries.sql`

**Steps:**
1. Run CHECK 1: identify returns without JEs per company
2. Run CHECK 2–3: get AP and Inventory account IDs for each company
3. For each affected return: execute BLOCK A template with real values
4. Run POST-REPAIR verification: discrepancy should be 0.01 or less for all returns

**Note:** The repair script is a template — it does not auto-post all JEs because each company may have different account IDs. Run it per-company with the correct account IDs from checks 2–3.

---

## 7. Build Verification

`npm run build` — 0 TypeScript errors after this patch.

The import of `resolvePayablePostingAccountId` is from the same service layer already used by `purchaseAccountingService.ts` (line 16 of that file). No circular dependency introduced.
