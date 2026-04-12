# FINAL: Purchase Payment Account-Change Polarity and History Lock Fix

## Summary

Fixed the purchase payment account-change transfer JE posting with wrong polarity. The `postPaymentAccountAdjustment` function always posted `Dr new_account, Cr old_account`, which is correct for customer receipts (move inflow) but wrong for purchase payments (move outflow). This caused double-crediting of the old liquidity account and wrong debiting of the new one.

**Live case:** PUR-0002 / supplier SATTAR / PAY-0017 — JE-0089 posted `Dr Bank(1010) 15k, Cr Petty-Cash(1001) 15k` instead of the correct `Dr Petty-Cash 15k, Cr Bank 15k`.

---

## Root cause

### Why JE-0089 was wrong

**Purchase payment primary (JE-0088):** Dr AP-SATTAR 15k, Cr Petty-Cash(1001) 15k  
This is correct — paying a supplier = debit AP (reduce payable), credit liquidity (cash outflow).

**Account change Petty-Cash → Bank (JE-0089):** Dr Bank(1010) 15k, Cr Petty-Cash(1001) 15k  
This is **WRONG**. The intent was to move the outflow from Petty Cash to Bank:
- Petty Cash already had a 15k credit (outflow) from JE-0088
- The transfer should **neutralize** that credit (Dr Petty-Cash 15k) and establish the outflow on Bank (Cr Bank 15k)
- Instead, it **deepened** the credit on Petty Cash (another Cr 15k = total -30k) and added a debit to Bank (+15k)

### Correct purchase account-change polarity

| Scenario | Primary JE | Transfer JE (correct) |
|----------|-----------|----------------------|
| **Customer receipt** (inflow) | Dr Cash(old), Cr AR | Dr Cash(new), Cr Cash(old) — move the debit |
| **Purchase payment** (outflow) | Dr AP, Cr Cash(old) | Dr Cash(old), Cr Cash(new) — move the credit |

The transfer sign pattern is **opposite** between customer and purchase flows because customer receipts move money IN (debit side) while purchase payments move money OUT (credit side).

### Code that was wrong

`postPaymentAccountAdjustment` in `paymentAdjustmentService.ts` lines 379-383 unconditionally posted:
```
Dr new_account, Cr old_account
```
This is correct for `context === 'sale'` (customer receipts) but wrong for `context === 'purchase'` (supplier payments).

---

## Was supplier due actually wrong?

**No** — the AP-SATTAR side was mathematically correct in the screenshot state.

The chain (before void) netted:
- JE-0088: Dr AP 15k
- JE-0090: Cr AP 5k (amount edit 15k→10k)
- Net AP: Dr 10k (reduces payable by 10k)

Combined with JE-0031 (Dr AP 15k for PAY-0002), total AP debits = 25k against purchase credit of 35k → payable = 10k. This was correct for the intended payment of 10k.

**Only the liquidity accounts were wrong:**
- Petty Cash(1001): -30k (should be 0 after account change)
- Bank(1010): +20k (should be -10k, i.e., 10k outflow)

### Is JE-0031 part of valid payable math?

**Yes.** JE-0031 is the original purchase payment PAY-0002 (15k on CASH G140), still active and valid. It correctly reduces the 35k purchase liability by 15k.

---

## Expected math for the new chain (PAY-0017)

If operator enters: 15k on Petty Cash → change to Bank → edit to 10k:

| JE | Dr | Cr | Purpose |
|----|----|----|---------|
| Primary | AP 15k | Petty-Cash 15k | Payment from petty cash |
| Transfer | Petty-Cash 15k | Bank 15k | Move outflow old→new |
| Amount delta | Bank 5k | AP 5k | Decrease payment by 5k |

**Expected net:**
- AP: +15k - 5k = +10k (Dr net, reduces payable)
- Petty-Cash: -15k + 15k = 0 (neutralized)
- Bank: -15k + 5k = -10k (10k outflow)

**What was posted (wrong):**
- AP: +15k - 5k = +10k ← correct
- Petty-Cash: -15k - 15k = -30k ← wrong (should be 0)
- Bank: +15k + 5k = +20k ← wrong (should be -10k)

---

## Current live state

All JEs in the PAY-0017 chain (JE-0088, JE-0089, JE-0090) were already voided by the operator (via the "Cancel payment" flow implemented in the previous fix). PAY-0017 itself is voided. The current state is clean:

| Metric | Value |
|--------|-------|
| SATTAR operational payable | 20,000 |
| SATTAR GL AP payable | 20,000 |
| PUR-0002 paid_amount | 15,000 (PAY-0002 only) |
| PUR-0002 due_amount | 20,000 |
| Petty Cash (1001) active net | 0 (no active JEs) |
| Bank (1010) active net | 0 |
| Orphaned active adjustments | 0 |

**No additional data repair was needed** — the void-all-chain fix from the previous session correctly cancelled the entire chain.

---

## Code change

### `src/app/services/paymentAdjustmentService.ts` — `postPaymentAccountAdjustment`

**Before (wrong):**
```typescript
// Always Dr new, Cr old — regardless of context
const lines = [
  { account_id: newAccountId, debit: amount, credit: 0 },
  { account_id: oldAccountId, debit: 0, credit: amount },
];
```

**After (correct):**
```typescript
// Customer receipt (inflow): Dr new, Cr old — move the debit
// Purchase payment (outflow): Dr old, Cr new — move the credit
const lines = context === 'purchase'
  ? [
      { account_id: oldAccountId, debit: amount, credit: 0, description: `Neutralize outflow – ${ref}` },
      { account_id: newAccountId, debit: 0, credit: amount, description: `New outflow – ${ref}` },
    ]
  : [
      { account_id: newAccountId, debit: amount, credit: 0, description: `Payment – ${ref}` },
      { account_id: oldAccountId, debit: 0, credit: amount, description: `Transfer out – ${ref}` },
    ];
```

### Callers verified

All callers pass the correct `context`:
- `purchaseService.ts` → `context: 'purchase'` ✓
- `saleService.ts` → `context: 'sale'` ✓
- `UnifiedPaymentDialog.tsx` → `context: 'purchase'` for supplier, `context: 'sale'` for customer ✓
- `syncPaymentAccountAdjustmentsForCompany` → determined dynamically from AP debit on primary JE ✓

---

## UI safety (already in place)

From previous session's work:

1. **Historical chain members:** Show "Historical" badge, editing blocked in TransactionDetailModal with amber warning.
2. **Latest active node:** Shows "Latest" badge, only this one can be edited.
3. **Multi-member chains:** Show "Undo edit" (rollback last mutation) and "Cancel payment" (void entire chain) as separate actions.
4. **Account Statements:** Effective vs audit mode with PF-14 transfer rows dimmed in effective view.
5. **Day Book:** Presentation column distinguishes primary vs PF-14 rows.

---

## Regression results

### All contacts (9 with balances)

| Contact | Type | Operational | GL | Match |
|---------|------|------------|-----|-------|
| ABC | both | 105,000 recv | 105,000 | ✓ |
| Ali | customer | 170,001 recv | 170,001 | ✓ |
| DIN COLLECTION | supplier | 5,000 pay | 5,000 | ✓ |
| DIN COUTURE | supplier | 415,000 pay | 415,000 | ✓ |
| KHURAM SILK | supplier | 575,060 pay | 575,060 | ✓ |
| Nadeem | customer | 84,500 recv | 84,500 | ✓ |
| Salar | customer | 70,000 recv | 70,000 | ✓ |
| SATTAR | supplier | 20,000 pay | 20,000 | ✓ |

### Orphaned adjustment JEs for voided payments

**0** — zero orphaned active adjustments.

### Liquidity accounts

| Account | Net |
|---------|-----|
| Petty Cash (1001) | 0 (no active JEs) |
| CASH G140 (1002) | 114,999 (normal) |
| Bank (1010) | 0 |
| Bank Accounts (1060) | not present (clean) |

### Sync replay check

All 18 active payments have primary JEs with matching liquidity accounts. No mismatches that would trigger sync replay on Accounting page load.

---

## Success checklist

- [x] PUR-0002 / SATTAR live case data is clean (voided chain, correct payable)
- [x] Purchase payment account-change now uses correct outflow direction (Dr old, Cr new)
- [x] Customer receipt account-change retains correct inflow direction (Dr new, Cr old)
- [x] Old liquidity account is neutralized correctly in purchase flow
- [x] Latest effective amount sits only on the final liquidity account
- [x] Historical nodes show "Historical" badge and are locked
- [x] Only latest active node is editable
- [x] No reload-time duplicate replay appears
- [x] Build passes (exit code 0)
- [x] Final markdown report written

---

## Related docs

- `docs/accounting/FINAL_PURCHASE_PAYMENT_REVERSE_SEMANTICS_AND_MUTATION_ROLLBACK_FIX.md` — void-all-chain fix
- `docs/accounting/FINAL_PAYMENT_EDIT_REPAIR_AND_EFFECTIVE_LEDGER_CLOSURE.md` — PF-14 framework
- `docs/accounting/HOTFIX_PAYMENT_EDIT_ORDERING_AND_ACCOUNT_STATEMENT_PRESENTATION.md` — statement presentation
