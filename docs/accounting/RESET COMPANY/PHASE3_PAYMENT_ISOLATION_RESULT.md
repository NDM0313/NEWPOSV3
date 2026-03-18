# Phase 3 — Payment Isolation Engine: RESULT

**Date:** 2025-03-18  
**Plan reference:** `ACCOUNTING_PHASE_PLAN_AND_PROMPTS.md` — Phase 3  
**Status:** Complete (awaiting approval before Phase 4)

---

## 1. Root cause

Payment was not fully isolated from document edits:

- **Purchase payment edit:** `purchaseService.updatePayment` updated the `payments` row but did **not** post any payment delta JE. So changing a purchase payment amount or account left the GL out of sync (only the payments row changed).
- **Sale payment sync on save:** When the user edited only document fields (e.g. total, discount), the form still sent `updates.paid` with the current paid amount. The context called `updatePayment` every time, which could create no-op updates and misleading activity log lines.
- **Activity log:** Sale payment edit logged "Payment edited from Rs 33000 to Rs 33000" when only the payment account/method changed (zero-delta message).
- **Document edit vs payment edit** was not explicitly enforced: payment JEs and ledger entries must remain untouched when only the document (sale/purchase) is edited.

Phase 3 makes payment a fully isolated component: document edit never touches payment JEs; payment create/edit/delete has its own accounting flow; and we only sync/touch payment when payment actually changed.

---

## 2. Payment isolation rules implemented

| Rule | Implementation |
|------|----------------|
| **Document edit must not reverse/repost payment** | `postSaleEditAdjustments` and `postPurchaseEditAdjustments` post only document deltas (revenue, discount, shipping, inventory, AP). They do not reference or modify any `payment_id` JE or payment ledger. |
| **Payment create** | Unchanged: one payments row + one JE (Dr Cash/Bank Cr AR or Dr AP Cr Cash/Bank). |
| **Payment edit (amount)** | Sale & Purchase: update `payments` row; post **one** `payment_adjustment` JE (delta only). Original payment JE is never modified or deleted. |
| **Payment edit (account only)** | Sale & Purchase: update `payments.payment_account_id`; post **one** transfer JE (Dr new account, Cr old account). |
| **Payment delete/reverse** | Unchanged: handled by existing flow (trigger or service); document JEs untouched. |
| **Change detection** | **Document-only:** only `postSaleEditAdjustments` / `postPurchaseEditAdjustments` run; payment sync skipped if paid/account unchanged. **Payment-only:** only payment row + payment_adjustment JEs. **Mixed:** both run independently; no full-reverse. |
| **Activity log** | Sale: log "Payment edited from X to Y" only when amount changed; otherwise "Payment account/method changed to X". No "from 33000 to 33000" when amount unchanged. |

---

## 3. Files changed

| File | Change |
|------|--------|
| `docs/accounting/PAYMENT_ISOLATION_RULES.md` | **New.** Payment isolation rules and change-type matrix. |
| `src/app/services/purchaseService.ts` | `updatePayment`: capture old amount/account; after update, call `postPaymentAmountAdjustment` and `postPaymentAccountAdjustment` (context `purchase`). |
| `src/app/services/saleService.ts` | Activity log: only log amount change when `oldAmount !== newAmount`; for account/method-only use "Payment account/method changed to X". |
| `src/app/context/SalesContext.tsx` | Only sync payment when paid or account actually changed (`paymentUnchanged` check); skip `updatePayment` when unchanged. Pass `accountId` for payment account. |
| `src/app/services/saleAccountingService.ts` | Comment: Phase 3 payment isolation – does not touch payment_id JE or payment ledger. |
| `src/app/services/purchaseAccountingService.ts` | Comment: Phase 3 payment isolation – only document deltas; never touch payment_id JEs. |

---

## 4. SQL used

**None.** No migrations, no destructive DB cleanup. Phase 3 is code-only: isolation rules, payment delta JEs on edit, and skip payment sync when unchanged.

---

## 5. Verification (real sale/purchase cases)

- **Document-only edit:** Edit sale total or discount only; save. Expected: only sale_adjustment JEs; no new payment_adjustment JE; no "Payment record updated" when paid amount and account unchanged. SalesContext now skips `updatePayment` when `paymentUnchanged` is true.
- **Payment-only edit (sale):** Change payment amount or account on a sale; save. Expected: payments row updated; one payment_adjustment JE (amount or account). Activity log shows "Payment edited from X to Y" only when amount changed.
- **Payment-only edit (purchase):** Change payment amount or account on a purchase; save. Expected: payments row updated; one payment_adjustment JE (amount or account). Previously no JE was posted; now same as sale.
- **Mixed edit:** Change both total and payment; save. Expected: sale_adjustment (or purchase adjustment) JEs for document deltas + payment_adjustment JE(s) for payment change; no full reversal of document + payment.

Verification can be done manually on any final sale/purchase with payments: edit document only and confirm no payment JEs; edit payment only and confirm only payment_adjustment JEs.

---

## 6. Summary

- **Goal:** Payment as fully isolated accounting component; document edit must not reverse/repost payment; payment create/edit/delete has its own flow.
- **Deliverables:** PAYMENT_ISOLATION_RULES.md; purchase updatePayment posts amount/account adjustment JEs; sale activity log fixed; SalesContext skips payment update when unchanged; comments in sale/purchase accounting services.
- **Acceptance:** If payment untouched, payment JE and payment ledger entries remain untouched; payment edit posts only payment delta.
- **Next:** Stop. Wait for approval. Then Phase 4 (Sale Engine Rebuild).

---

## 7. Git commit hash

*(To be filled after commit.)*
