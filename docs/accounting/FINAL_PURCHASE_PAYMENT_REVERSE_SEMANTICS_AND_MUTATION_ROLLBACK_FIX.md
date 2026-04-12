# FINAL: Purchase Payment Reverse Semantics and Mutation Rollback Fix

## Summary

Fixed the purchase payment multi-edit chain reversal bug where reversing a payment with multiple edits (account change + amount edit) destroyed the full effective payment instead of cleanly cancelling it, leaving the supplier payable at an incorrect value.

**Live case:** PUR-0002 / supplier SATTAR / PAY-0004 — payable was 35,000 instead of expected 20,000.

---

## Root cause

### Why JE-0087 was wrong for user intent

JE-0087 was a "composite reversal" that posted **Dr Bank(1010) 14,000 / Cr AP-SATTAR 14,000**. Mathematically this is what you'd post to reverse a simple 14k payment from Bank→AP. However:

1. The composite reversal used `payments.amount` (14,000) and `payments.payment_account_id` (Bank 1010) to build a fresh 2-line reversal — it assumed the entire chain's effective state was a clean Dr AP 14k, Cr Bank 14k.
2. After the reversal JE was posted, `voidPaymentAfterJournalReversal` voided the **primary JE only** (JE-0083: Dr AP 15k, Cr G140 15k), because it filtered on `reference_type IN ('manual_payment', 'manual_receipt', 'on_account')`.
3. The **PF-14 adjustment JEs** (JE-0084, JE-0085, JE-0086) were NOT voided — they remained active.
4. With JE-0083 voided (losing the Dr AP 15k) but JE-0085 (Cr AP 1k) and JE-0087 (Cr AP 14k) still active, the AP-SATTAR account gained an extra 15k credit, pushing payable from 20k to 35k.

### Was it mathematically valid for full cancellation?

No. Even as a "full cancellation" it was incorrect because:
- The reversal was designed to offset the effective payment total against AP and the current liquidity account only.
- It ignored the intermediate liquidity transfers (JE-0084: G140→Bank-Accts, JE-0086: Bank-Accts→Bank) which remained active after the primary was voided.
- Net of all active JEs after the reversal: AP=-15k, Bank=+28k, G140=-15k, Bank-Accts=+2k — not zero on any account.

### Why that counts as a product bug

The operator expected "cancel this payment" to result in **zero net effect** from the entire payment chain. Instead, the chain left residue on AP, Bank, G140, and Bank-Accts. The operator saw payable jump from 20k to 35k — a 15k error caused by orphaned adjustment JEs.

---

## Chronological chain (PAY-0004 / ee0fba17)

| Step | JE | Action | Lines | is_void |
|------|------|--------|-------|---------|
| 1 | JE-0083 | Primary manual_payment 15k on G140 | Dr AP 15k, Cr G140 15k | **Yes** (voided during step 5) |
| 2 | JE-0084 | Account change G140→Bank-Accts(1060) | Dr 1060 15k, Cr G140 15k | **Yes** (repaired) |
| 3 | JE-0085 | Amount edit 15k→14k | Dr 1060 1k, Cr AP 1k | **Yes** (repaired) |
| 4 | JE-0086 | Account change 1060→Bank(1010) | Dr 1010 14k, Cr 1060 14k | **Yes** (repaired) |
| 5 | JE-0087 | Composite reversal (WRONG) | Dr 1010 14k, Cr AP 14k | **Yes** (repaired) |

After repair: all 5 JEs voided → zero net on all accounts from PAY-0004 chain.

---

## Live data repair

### SATTAR / PAY-0004 chain

```sql
-- Void orphaned JE-0084, JE-0085, JE-0086, JE-0087
UPDATE journal_entries
SET is_void = true,
    void_reason = 'Voided: payment chain repair — primary JE-0083 already voided during reversal; adjustment JEs orphaned, composite reversal JE-0087 used wrong AP basis'
WHERE id IN (
  '4be7b09b-5fdc-4e3a-b411-fdc7e101d3c7',  -- JE-0084
  '193dc571-0efd-4dae-bf13-75b0a85c5f44',  -- JE-0085
  '595f370f-0aca-48d2-bc4f-c5c1e8c6fb80',  -- JE-0086
  '0eb9f49b-39ec-4798-a935-279692f17949'   -- JE-0087
)
AND company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'
AND is_void = false;
-- Result: UPDATE 4
```

### Nadeem / RCV-0005 chain (same bug class, also repaired)

```sql
-- Payment 45b0bd3a (RCV-0005) was already voided but adjustment JEs JE-0073..JE-0077 + JE-0081 remained active.
UPDATE journal_entries
SET is_void = true,
    void_reason = 'Voided: payment chain repair — payment RCV-0005 already voided, orphaned chain members cleaned up'
WHERE company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'
  AND (
    payment_id = '45b0bd3a-4bef-4b75-baa9-f5a41a483217'
    OR (reference_type = 'payment_adjustment' AND reference_id = '45b0bd3a-4bef-4b75-baa9-f5a41a483217'::uuid)
    OR (reference_type = 'correction_reversal' AND payment_id = '45b0bd3a-4bef-4b75-baa9-f5a41a483217')
  )
  AND is_void = false;
-- Result: UPDATE 6
```

---

## Before vs After balances

### SATTAR (supplier)

| Metric | Before repair | After repair |
|--------|--------------|--------------|
| Operational payable | 20,000 | 20,000 |
| GL AP payable | 35,000 | **20,000** |
| PUR-0002 paid_amount | 15,000 | 15,000 |
| PUR-0002 due_amount | 20,000 | 20,000 |
| Bank (1010) net | +28,000 residue | 0 |
| CASH G140 (1002) net | -15,000 residue | 0 (from this chain) |
| Bank Accounts (1060) net | +2,000 residue | 0 |

### Nadeem (customer)

| Metric | Before repair | After repair |
|--------|--------------|--------------|
| Operational receivable | 84,500 | 84,500 |
| GL AR receivable | 80,000 (4.5k off) | **84,500** |

### All contacts (post-repair regression check)

| Contact | Operational | GL | Match |
|---------|------------|-----|-------|
| ABC | 105,000 recv | 105,000 | ✓ |
| Ali | 170,001 recv | 170,001 | ✓ |
| DIN COLLECTION | 5,000 pay | 5,000 | ✓ |
| DIN COUTURE | 415,000 pay | 415,000 | ✓ |
| KHURAM SILK | 575,060 pay | 575,060 | ✓ |
| Nadeem | 84,500 recv | 84,500 | ✓ |
| Salar | 70,000 recv | 70,000 | ✓ |
| SATTAR | 20,000 pay | 20,000 | ✓ |

---

## Code changes

### 1. `src/app/services/paymentLifecycleService.ts`

**`voidPaymentAfterJournalReversal`** — now calls `voidAllPaymentChainJournals` which voids:
- ALL JEs with `payment_id = paymentId` (primary types)
- ALL JEs with `reference_type = 'payment_adjustment' AND reference_id = paymentId`
- Excludes `correction_reversal` (the audit record of the cancellation itself)

Previously only voided JEs with `reference_type IN ('manual_receipt', 'on_account', 'manual_payment')`, leaving PF-14 adjustments orphaned.

**`undoLastPaymentMutation`** (NEW) — rollback-to-previous-state:
1. Reads the latest `transaction_mutations` entry for this payment.
2. Voids only the tail (latest) adjustment JE.
3. Reverts `payments` row fields (`amount`, `payment_account_id`) to the `old_state` from the mutation log.
4. Records a `restore` mutation in the audit trail.

### 2. `src/app/services/accountingService.ts` — `createReversalEntry`

**Multi-member payment chain path** (complete rewrite):
- No longer posts a composite reversal JE.
- Instead: directly calls `voidPaymentAfterJournalReversal` which voids ALL chain members.
- Records a `reversal` mutation in transaction_mutations.
- Dispatches refresh events (`paymentAdded`, `ledgerUpdated`).

**Single JE path** (unchanged):
- Classic mirror reversal JE with swapped Dr/Cr.
- Then voids the payment row (including all chain JEs via the new lifecycle function).

### 3. `src/app/context/AccountingContext.tsx`

Added `undoLastPaymentMutation(paymentId: string): Promise<boolean>` to the context interface and implementation, wired to the paymentLifecycleService.

### 4. `src/app/components/accounting/AccountingDashboard.tsx`

**Multi-member chain rows** now show two distinct actions instead of a single "Reverse" button:
- **"Undo edit"** (orange) — calls `undoLastPaymentMutation`, voids only the latest adjustment JE and restores previous state.
- **"Cancel payment"** (red) — calls `createReversalEntry`, voids entire chain.

**Single-JE rows** retain the existing "Reverse" button unchanged.

Added `Undo2` icon import from lucide-react.

### 5. `src/app/services/paymentChainCompositeReversal.ts`

No longer called by `createReversalEntry` for multi-member chains (dead code for that path). Retained for potential future use in single-JE contexts.

---

## How previous-state rollback now works

1. User sees a multi-member payment chain with "Latest" badge.
2. Clicks **"Undo edit"** on the tail row.
3. System reads the latest `transaction_mutations` entry for this payment.
4. Voids only the tail adjustment JE (e.g., an account-change or amount-edit JE).
5. Reverts `payments.amount` or `payments.payment_account_id` to the previous value.
6. Records a `restore` mutation for audit.
7. UI refreshes — the chain is now one member shorter, previous state is effective.

## How full cancellation now works

1. User clicks **"Cancel payment"** on the tail row.
2. System calls `createReversalEntry` which detects `chainMemberCount > 1`.
3. Calls `voidPaymentAfterJournalReversal` which:
   - Deletes `payment_allocations`
   - Sets `payments.voided_at`
   - Voids ALL JEs in the chain (primary + all PF-14 adjustments)
4. Net effect on all accounts: zero.
5. Records a `reversal` mutation.
6. UI refreshes — all chain rows show as voided.

---

## Regression results

### Purchase payment chain (SATTAR)

- Operational payable: 20,000 ✓
- GL AP payable: 20,000 ✓
- PUR-0002 paid/due: 15k / 20k ✓
- No orphaned active JEs for voided payments ✓
- Liquidity accounts clean ✓

### Customer receipt chain (Nadeem / RCV-0005)

- Operational receivable: 84,500 ✓
- GL AR receivable: 84,500 ✓
- No orphaned active JEs ✓

### Full contact regression (all 9 contacts with balances)

All contacts show operational = GL with zero variance.

### Build

`npm run build` exits with code 0.

---

## Remaining risks

1. **Historical single-JE payment reversals** (non-chain) still use the classic mirror approach. This is correct for single JEs but should be monitored.
2. **`paymentChainCompositeReversal.ts`** is no longer used by the main reversal path but is retained. Can be removed in a cleanup pass.
3. **`transaction_mutations` table dependency** — the `undoLastPaymentMutation` function relies on `transaction_mutations` having the correct `adjustment_journal_entry_id` and `old_state`. Mutations created before Phase 4 may not have complete data. The undo path returns null if no matching mutation is found.

---

## Success checklist

- [x] PUR-0002 / SATTAR live case restored correctly (payable = 20,000)
- [x] Reverse no longer destroys the whole payment chain — voids all members cleanly
- [x] "Undo edit" available for multi-member chains to roll back to previous state
- [x] "Cancel payment" available for explicit full cancellation
- [x] Historical nodes already have "Historical" badge, latest has "Latest" badge
- [x] Purchase and customer chains both pass regression
- [x] No orphaned active adjustment JEs for voided payments remain
- [x] Final markdown report written
