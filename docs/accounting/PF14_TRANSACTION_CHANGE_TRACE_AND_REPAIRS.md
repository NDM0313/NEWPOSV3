# PF-14 transaction change trace & production repairs

This document records **why** customer/GL/Roznamcha views diverged, **what** was changed in code and on the VPS database, and **where** to look in the repo for tracing.

It is aimed at developers and operators debugging **payment edits**, **manual receipts**, and **account (liquidity) changes** under PF-14.

---

## 1. Engines (do not merge mentally)

| View | Source of truth |
|------|------------------|
| **Operational** customer/supplier ledger | `payments` (+ allocations), excludes `voided_at` in live scope |
| **GL (journal)** | `journal_entries` / `journal_entry_lines`, optionally excluding `is_void` |
| **Roznamcha** | One row per **payment**; PF-14 transfer JEs do not add a second cash-book row |
| **Party GL** (Contacts strip, Reconciliation) | RPCs on AR/AP **subtree** (e.g. party accounts under 1100) |

Two rows with the same economic receipt (e.g. primary receipt + PF-14 “transfer”) are **not** duplicates in Roznamcha; they are **one payment** + **journal legs**.

---

## 2. Root causes addressed in this effort

### 2.1 `journal_entries.total_debit` / `total_credit` stuck at zero

- **Cause:** `accountingService.createEntry` inserted the header without updating totals after inserting lines.
- **Fix (code):** After line insert, update header `total_debit` / `total_credit`.
- **Fix (DB):** Migration `20260434_journal_entry_totals_sync_trigger.sql` — trigger on `journal_entry_lines` + one-time backfill.

### 2.2 Voided `payments` row but active `manual_receipt` JE

- **Cause:** Reversal path voided the payment via `voidPaymentAfterJournalReversal` but a **primary** `manual_receipt` JE could remain active (or void was done outside that path).
- **Fix (code):** `paymentLifecycleService.voidPaymentAfterJournalReversal` also voids linked primary JEs with `reference_type` in (`manual_receipt`, `on_account`, `manual_payment`).

### 2.3 Stale `oldAccountId` on PF-14 account change (Mobile Wallet **1020** → NDM **1011**)

- **Cause:** Idempotency `hasExistingPaymentAccountAdjustment` matched **exact** `(oldAccountId, newAccountId, amount)`. After **1020 → 1000 → 1011**, a UI double-save with **old = 1020** still passed checks because the active leg was **1000 → 1011** (JE-0062), not **1020 → 1011**.
- **Symptom:** Repeated `payment_adjustment` JEs: Dr **1011** 45,000 / Cr **1020** 45,000 (JE-0067, JE-0070, JE-0071, …) while `payments.payment_account_id` was already **1011**.
- **Fix (data):** Void duplicate JEs (see §4).
- **Fix (code):** `postPaymentAccountAdjustment` in `paymentAdjustmentService.ts` — if the payment row already has `payment_account_id === newAccountId`, amount matches the payment, and **sum of Dr on `newAccountId`** across active “Payment account changed” JEs for that payment already reaches the amount, **skip** (trace: `paymentAdjustment.post_account_adjust.skip_destination_already_funded`).

### 2.4 Unique fingerprint + void = slot reused

- Partial unique index on `(company_id, action_fingerprint)` where `is_void IS NOT TRUE` allows the **same** fingerprint to be inserted again after the previous row is voided — enabling identical bad reposts unless the new guard above blocks them.

---

## 3. Code touchpoints (tracing)

| Area | File / symbol |
|------|----------------|
| Payment account PF-14 post | `src/app/services/paymentAdjustmentService.ts` — `postPaymentAccountAdjustment`, `sumDebitOnAccountPaymentAccountChangeJes` |
| Payment amount PF-14 | `paymentAdjustmentService.ts` — `postPaymentAmountAdjustment` |
| Idempotency helpers | `src/app/services/accountingService.ts` — `hasExistingPaymentAccountAdjustment`, `hasExistingPaymentAmountAdjustment` |
| Journal create + totals | `accountingService.ts` — `createEntry` |
| Void payment + void primary JE | `src/app/services/paymentLifecycleService.ts` — `voidPaymentAfterJournalReversal` |
| Reversal → void payment | `accountingService.ts` — `reverseJournalEntry` (calls `voidPaymentAfterJournalReversal` for manual_receipt / on_account / manual_payment) |
| Dev traces | `src/app/lib/paymentEditFlowTrace.ts`, `[PAYMENT_EDIT_TRACE]` |
| Transaction detail / edit routing | `src/app/components/accounting/TransactionDetailModal.tsx`, `src/app/lib/unifiedTransactionEdit.ts` |
| Canonical investigation UI | Developer Tools → **AR / AP Truth Lab** (`/test/ar-ap-truth-lab`) |
| SQL helpers | `scripts/detect_duplicate_payment_posting.sql`, `scripts/verify-payment-mutation-chain.sql` |

---

## 4. Production repairs (company `595c08c2-1e47-4581-89c9-1f78de51c613`) — summary

Exact IDs and reasons live in void_reason / migration logs; high level:

| Item | Action |
|------|--------|
| **PAY-0014** / JE-0044 typo + orphan adjustment | Void JE-0044 / JE-0047; replacement clean `manual_receipt` JE for 24,999 |
| **RCV-0002** (Salar) vs GL | Unvoid payment; link repair JE to `payment_id` where applicable |
| **JE-0035** / voided **PAY-0006** | Void primary JE to match voided payment; header totals fixed by trigger |
| **RCV-0004** (`eab66f1f…`) stale **1020 → 1011** dupes | Void **JE-0067**, **JE-0070**, **JE-0071** (and earlier **JE-0063** already void); keep **JE-0062** as canonical **1000 → 1011** leg |
| Global | Apply `20260434` on DB; backfill header totals |

### 4.1 Account **1020** — `16a6109b-ffae-41dd-9e16-f0155752ae80` (Mobile Wallet)

- All **non-void** lines on this account should net consistently with other liquidity accounts after the RCV-0004 chain.
- **Active** duplicate Cr **1020** / Dr **1011** for **45,000** on the same payment were voided so the wallet is not over-credited after liquidity had already left **1020** via **JE-0060** and reached **1011** via **JE-0062**.
- After voiding **JE-0070** and **JE-0071**, **active** net on **1020** for the company was verified **0** in a quick Dr−Cr aggregation (includes other unrelated receipts on the same wallet).

---

## 5. Operator checklist when “statement ≠ ledger”

1. Confirm **payment** `voided_at` vs **primary JE** `is_void`.
2. Open **Truth Lab** for the `payment_id`; list active `payment_adjustment` JEs.
3. Check **1020 / 1000 / 1011** (or relevant cash accounts) for **repeated** same-amount Dr **NDM** legs.
4. Prefer **void duplicate PF-14** with a written `void_reason`; do not delete lines.
5. Deploy **latest** `postPaymentAccountAdjustment` guard so stale **oldAccountId** does not repost.

---

## 6. Related docs

- `docs/accounting/FINAL_PAYMENT_EDIT_REPAIR_AND_EFFECTIVE_LEDGER_CLOSURE.md` — narrative closure on specific payment repairs.
- `docs/accounting/FINAL_EDIT_FLOW_AUDIT_AND_DUPLICATE_POSTING_REPORT.md` — edit flow / duplicate posting (if present on branch).

---

*Last updated: 2026-04-10 — aligns with branch work on PF-14 guards, `20260434`, and VPS voids for JE-0067 / JE-0070 / JE-0071.*
