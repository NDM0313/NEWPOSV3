# Accounting Stabilization Phase 3 – Deliverables

Company: `eb71d817-b87e-4195-964b-7b5321b480f5`

---

## 1. Root cause of manual entry not showing in Roznamcha

**Cause:** Manual entries were created only as journal entries via `AccountingContext.createEntry` (source `Manual`). No row was ever inserted into `payments`. Roznamcha is **payments-only**, so those entries never appeared.

**Fix:** Manual entries are now classified at create time:

- **If one side is a payment account** (Cash/Bank/Mobile Wallet, by code 1000/1010/1020 or name/type): we insert a `payments` row (`reference_type` `manual_receipt` or `manual_payment`, PAY ref from `documentNumberService`), link the journal entry via `payment_id`, and use `reference_type` `manual_receipt`/`manual_payment` on the journal. These appear in Roznamcha.
- **If both sides are non–payment accounts:** we create the journal only (no `payments` row, no `payment_id`). These do **not** appear in Roznamcha (by design).

---

## 2. Root cause of duplicate supplier payment journals

**Cause:** Two separate code paths created journal entries for the same supplier payment:

1. **`purchaseService.recordPayment`** (document-linked): inserted into `payments` and then created a journal entry (Dr AP, Cr Cash/Bank) with `payment_id` set.
2. **`AccountingContext.recordSupplierPayment`** (called after the above from `UnifiedPaymentDialog` and from `PurchaseContext.recordPayment`): called `createEntry` again with source `Purchase`, Dr AP / Cr Cash, producing a **second** journal entry for the same business event.

So one supplier payment produced **1 payment + 2 JEs** (one tagged Payment, one Purchase). For on-account, `recordOnAccountPayment` only inserted the payment; the dialog then called `recordSupplierPayment`, which created the single JE (no duplicate there, but the pattern was inconsistent).

**Fix:** All supplier payments (document-linked and on-account) now go through the **canonical supplier payment service**, which creates exactly **1 payment + 1 journal entry**. The extra call to `accounting.recordSupplierPayment` was removed in:

- `UnifiedPaymentDialog` (supplier, both document-linked and on-account)
- `PurchaseContext.recordPayment`

So one supplier payment action now yields **1 payments row + 1 balanced journal entry**, with no second JE.

---

## 3. Canonical manual entry rule implemented

- **Location:** `AccountingContext.createEntry` (manual payment/receipt branch) and helpers `isPaymentAccount` / `paymentMethodFromAccount`.
- **Rule A – Manual payment/receipt:** One side is a payment account (Cash/Bank/Mobile Wallet). We create one `payments` row (PAY ref from `documentNumberService.getNextDocumentNumber(..., 'payment')`), then one balanced journal entry with `payment_id` set. `reference_type` on the journal is `manual_receipt` (money in) or `manual_payment` (money out). These appear in Roznamcha.
- **Rule B – Pure manual journal:** Both sides are non–payment accounts. We create the journal entry only; no `payments` row, no `payment_id`. These do **not** appear in Roznamcha.
- Payment account detection uses account `code` (1000/1010/1020) and name/type (cash, bank, wallet).

---

## 4. Canonical supplier payment flow implemented

- **Service:** `src/app/services/supplierPaymentService.ts` – `createSupplierPayment(params)`.
- **Behaviour:** Gets PAY ref via `documentNumberService.getNextDocumentNumber(companyId, branchId, 'payment')`, inserts one row into `payments` (`reference_type` `purchase` or `on_account`), creates one journal entry (Dr AP, Cr Cash/Bank) with `payment_id` set, returns `{ paymentId, journalEntryId, referenceNumber }`.
- **Entry points using it:**
  - **Document-linked:** `purchaseService.recordPayment` now delegates to `createSupplierPayment` (and no longer creates its own payment + JE directly). Activity log still in `purchaseService`.
  - **On-account:** `purchaseService.recordOnAccountPayment` now delegates to `createSupplierPayment` (payment + JE in one place).
- **Removed duplicate path:** `UnifiedPaymentDialog` and `PurchaseContext.recordPayment` no longer call `accounting.recordSupplierPayment` after recording the payment.

---

## 5. Files changed

| File | Change |
|------|--------|
| `src/app/services/supplierPaymentService.ts` | **New.** Canonical supplier payment: PAY ref, payments insert, one JE. |
| `src/app/services/purchaseService.ts` | `recordPayment` and `recordOnAccountPayment` refactored to use `createSupplierPayment`; removed duplicate payment+JE logic and unused imports. |
| `src/app/components/shared/UnifiedPaymentDialog.tsx` | Supplier (document-linked and on-account): after `recordPayment` / `recordOnAccountPayment`, set `success = true` only; removed call to `accounting.recordSupplierPayment`. |
| `src/app/context/PurchaseContext.tsx` | Removed `accounting.recordSupplierPayment` after `purchaseService.recordPayment`. |
| `src/app/context/AccountingContext.tsx` | Manual entry classification: `isPaymentAccount`, `paymentMethodFromAccount`; when source `Manual` and one side is payment account, insert `payments` row and link JE via `payment_id`; set journal `reference_type` to `manual_receipt` / `manual_payment`; pass `paymentIdToLink` into `accountingService.createEntry`. |
| `src/app/services/roznamchaService.ts` | `getTypeLabel`: added `on_account`, `manual_receipt`, `manual_payment`. |
| `src/app/components/accounting/ManualEntryDialog.tsx` | Info text: when one side is Cash/Bank/Mobile Wallet, entry appears in Roznamcha; otherwise journal-only (no Roznamcha). |

---

## 6. SQL files created

| File | Purpose |
|------|--------|
| `docs/audit/manual_entry_roznamcha_gap.sql` | Manual journal rows that involve a payment account but have no linked `payments` row (gap for Roznamcha). |
| `docs/audit/supplier_payment_duplicate_journal_audit.sql` | Detects same supplier payment creating multiple JEs (payments with >1 JE by `payment_id`; standalone Purchase JEs with no `payment_id`; same-day/same-amount pairs). |
| `docs/audit/supplier_payment_canonical_audit.sql` | Payments row + journal mapping for supplier payments (purchase/on_account); lists gaps (payment without JE) and canonical JEs linked by `payment_id`. |
| `docs/audit/manual_entry_payment_account_classification.sql` | Classifies manual entries into payment_movement (has payment account in lines) vs pure_journal, and status (OK in Roznamcha / GAP / OK journal only). |

---

## 7. Verification checklist

- [ ] **Manual receipt:** Create manual entry Dr Cash, Cr Sales Revenue → one `payments` row (`manual_receipt`), one JE with `payment_id`; appears in Roznamcha.
- [ ] **Manual payment:** Create manual entry Dr Expense, Cr Bank → one `payments` row (`manual_payment`), one JE with `payment_id`; appears in Roznamcha.
- [ ] **Pure manual:** Create manual entry Dr AR, Cr Sales Revenue → one JE only, no `payments` row; does **not** appear in Roznamcha.
- [ ] **Supplier payment (document-linked):** Pay from UnifiedPaymentDialog or PurchaseContext → one `payments` row, one JE (with `payment_id`); Day Book shows single JE per payment.
- [ ] **Supplier on-account:** On-account supplier payment from dialog → one `payments` row (`on_account`), one JE; appears in Roznamcha with label “On-Account Supplier Payment”.
- [ ] Run `docs/audit/supplier_payment_duplicate_journal_audit.sql`: no (or minimal) duplicates for new payments.
- [ ] Run `docs/audit/manual_entry_roznamcha_gap.sql`: only legacy manual entries with payment account but no payment row (pre-fix); new manual payment/receipt entries should not appear here.
- [ ] Run `docs/audit/supplier_payment_canonical_audit.sql`: each supplier payment has exactly one linked JE.
- [ ] Run `docs/audit/manual_entry_payment_account_classification.sql`: new manual payment/receipt entries classified as `payment_movement` with “OK (in Roznamcha)”; pure manual as `pure_journal` with “OK (journal only, no Roznamcha)”.

---

## 8. Recommended next phase after this

- **Data cleanup (optional):** If `supplier_payment_duplicate_journal_audit.sql` or `manual_entry_roznamcha_gap.sql` show legacy issues, consider a one-off repair (e.g. mark or merge duplicate JEs, or backfill `payments` for old manual payment/receipt JEs) with a separate migration and approval; no broad table deletes.
- **Purchase paid_amount / payment_status:** Confirm whether these are derived from `payments` (e.g. trigger or app logic). If still stored on `purchases`, ensure they stay in sync when using only the canonical supplier payment path.
- **Expense payments:** Reconcile with the same idea (one payment + one JE, single entry point) if expense flows currently create duplicate or unlinked JEs.
- **Day Book / Report labels:** Ensure “Payment” vs “Purchase” (and manual_receipt / manual_payment) are clearly labeled so users are not confused by `reference_type` in reports.
