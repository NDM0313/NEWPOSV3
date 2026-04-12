# FINAL: Multi-edit payment effective state — root fix (PF-14.7)

## Executive summary

**Symptom:** After the first payment edit, things often look fine. On the **second or third** edit (amount and/or liquidity account), the system could post an **extra full transfer** (e.g. Petty Cash → Bank for the **full** 50,000) even though PF-14 had already moved liquidity through FHD MZ → Bank. Petty Cash went **negative**, Bank **double-counted**, party AR sometimes still looked “fine” while cash books broke.

**Root cause (not random):** `syncPaymentAccountAdjustmentsForCompany` in `paymentAdjustmentService.ts` runs on **every** `AccountingContext.loadEntries()` (opening Accounting, changing dates, etc.). It compared:

- **`effectiveLiquidity`** = liquidity leg parsed from the **primary** payment JE only (immutable original receipt — e.g. Petty Cash), vs  
- **`payments.payment_account_id`** = current declared book (e.g. Bank after user edits).

After PF-14 **account-change** JEs, the **primary receipt JE is intentionally unchanged** (audit-safe PF-14 design). So primary liquidity **still** shows the **original** account, while `payments.payment_account_id` correctly shows the **final** account. The sync treated that as a “mismatch” and posted **another** `Payment account changed – same amount, new account` transfer **on every load**, replaying from the stale primary account — a **duplicate replay** (screenshot class: JE-0078).

**First edit “works”** because often no PF-14 account-change row exists yet, or the mismatch pattern differs. **Later edits + repeated Accounting loads** amplified the bug.

This is **not** fixed by hiding ledger rows or editing one JE by hand; the **engine** that decided to post had to change.

---

## What we changed (code)

| Area | Change |
|------|--------|
| **`paymentAdjustmentService.ts`** | **`hasPaymentAccountChangedPf14Journal(companyId, paymentId)`** — detects existing non-void PF-14 JEs whose description matches “Payment account changed”. |
| **`syncPaymentAccountAdjustmentsForCompany`** | Before posting a backfill transfer, if **`hasPaymentAccountChangedPf14Journal`** is true → **skip** that payment (`skippedPf14Chain` counter). Primary JE liquidity is **not** authoritative once PF-14 account transfers exist; **`payments.payment_account_id`** is. |
| **`getPaymentEffectiveLiquiditySnapshot`** | Read-only helper for Truth Lab / audits (declared account vs primary JE vs PF-14 presence). |
| **`AccountingContext.tsx`** | Trace log includes **`skippedPf14Chain`** for observability. |
| **`postingDuplicateRepairService.ts`** | Default `sync` object includes **`skippedPf14Chain: 0`**. |

### Posting rules (canonical)

These were **already** intended in `saleService.updatePayment` / `postPaymentAmountAdjustment` / `postPaymentAmountAdjustment`:

1. **Amount only:** delta JE only; liquidity leg for delta uses **pre-update** payment account when amount + account change in one save (see inline comment in `saleService.updatePayment`).
2. **Account only:** one transfer JE Dr new / Cr old for **current** amount.
3. **Combined amount + account:** amount delta first (on old liquidity), then transfer old → new for **new** amount — order preserved in `saleService.updatePayment`.

**PF-14.7** adds:

4. **Load-time sync** must **never** treat primary JE as “where cash is now” if **any** PF-14 “Payment account changed” JE exists for that payment.

---

## Before vs after

| Before | After |
|--------|--------|
| Open Accounting → sync compares primary Petty vs payments Bank → posts another Petty→Bank for full amount | Sync **skips** when PF-14 account-change chain exists → **no replay on load** |
| Duplicate JE-0078-style rows, Petty negative, Bank inflated | New loads stop creating new duplicates; **existing bad JEs** still need void/repair (below) |

---

## Repairing the broken live chain (Nadeem / SL-0004)

**We do not delete history.** Invalid duplicate transfers should be **voided** with reason, after manual confirmation.

1. Identify the duplicate row (often the **last** extra “Payment account changed” that credits **Petty** and debits **Bank** for the **full** final amount while prior PF-14 rows already cleared Petty / funded Bank).
2. Use `scripts/verify_payment_effective_state_pf14_7.sql` with `company_id` and `payment_id`.
3. Void only after reconciling lines:

```sql
-- EXAMPLE — replace ids / entry_no with your confirmed duplicate from investigation
-- UPDATE journal_entries
-- SET is_void = true,
--     void_reason = 'PF-14.7 duplicate sync replay — primary JE vs payments row after PF-14 chain'
-- WHERE company_id = '...'
--   AND entry_no = 'JE-0078'
--   AND id = '...';
```

4. Re-run TB / account statements; optional: `runFullPostingRepair` in Developer Integrity Lab **after** engine deploy (sync will no longer recreate the problem).

**Note:** Exact `entry_no` / UUID must come from your DB. This repo does not execute production repairs automatically.

---

## Verification

1. **SQL:** `scripts/verify_payment_effective_state_pf14_7.sql`
2. **UI:** Edit payment 3+ times (amount + account); refresh Accounting / Journal many times — **no new** duplicate full transfer from original Petty.
3. **Trace:** `AccountingContext` dev trace shows `skippedPf14Chain` when payments hit the skip path.

---

## Affected files

- `src/app/services/paymentAdjustmentService.ts` — PF-14.7 guards + exports
- `src/app/context/AccountingContext.tsx` — trace field
- `src/app/services/postingDuplicateRepairService.ts` — sync default shape
- `scripts/verify_payment_effective_state_pf14_7.sql` — proof queries
- This document

**See also:** [JE_0074_0075_0078_DEEP_ANALYSIS_AND_REPAIR.md](./JE_0074_0075_0078_DEEP_ANALYSIS_AND_REPAIR.md) — line-level analysis for edited-payment chains and `scripts/analyze_case_je_0074_0075_0078.sql`.

---

## Remaining risks

- **Legacy data** with **no** PF-14 account-change JE but **manual** `payments.payment_account_id` fix: sync may still attempt one backfill (intended for old migrations).
- **Description mismatch:** If a future UI changes the “Payment account changed” description, `hasPaymentAccountChangedPf14Journal` might not detect — prefer a dedicated flag/column in a later migration.
- **Truth Lab** could call `getPaymentEffectiveLiquiditySnapshot` for richer UI; optional follow-up.

---

## How to test next time

1. New sale receipt on Petty → edit amount → edit account twice → edit amount again.
2. Between steps, **reload Accounting** repeatedly.
3. Confirm: Petty, intermediate bank/wallet, and final bank balances net correctly; **no extra** full transfer after PF-14 chain exists.
4. Watch console trace: `skippedPf14Chain` increments when sync skips stale-primary payments.

---

*PF-14.7 — effective liquidity resolver for **load sync**: trust PF-14 account-change presence over primary JE liquidity.*
