# PF-14.4 – Orphan/Duplicate Adjustment Cleanup + Idempotent Posting Engine

**Status:** Implemented  
**Mode:** Production-safe, accounting-safe, audit-safe  
**Priority:** Critical  

---

## 1. Root-cause analysis

**Why duplicate/orphan adjustment JEs were created:**

| Source | Cause |
|--------|--------|
| **Sale adjustment** | `postSaleEditAdjustments` called once per save, but no guard against double submit, retry, or repeated effect. Each call to `postAdjustmentJE` used a new `entry_no` (Date.now() + random) and inserted without checking for an existing identical adjustment. |
| **Payment amount adjustment** | `postPaymentAmountAdjustment` invoked from `saleService.updatePayment` when amount changed. No check for an existing JE for the same (paymentId, oldAmount, newAmount). Double save or retry created duplicate JEs. |
| **Payment account adjustment** | (1) `postPaymentAccountAdjustment` from `saleService.updatePayment` when only account changed. (2) **`syncPaymentAccountAdjustmentsForCompany`** run on **every `loadEntries()`** in AccountingContext (every Accounting tab open / date change). For each payment where effective debit account from JEs ≠ `payment.payment_account_id`, it posted a new "Payment account changed – same amount, new account" JE **without** checking if that exact transfer already existed. So opening Accounting multiple times or changing dates could add one JE per run. |
| **No idempotency key** | No deterministic key or pre-insert check; every call resulted in a new row. |

**Classification of bad entries:**

- **DUPLICATE_LINKED:** Multiple JEs for the same logical action (same sale_id + same description, or same payment_id + same amount/account change). Safe to void all but one.
- **ORPHAN_UNLINKED:** reference_id points to a deleted sale/payment. Safe to void for business reporting; keep for audit with is_void = true.
- **VALID_LINKED:** reference resolves, single JE per action; keep and show.

---

## 2. Files changed

| File | Change |
|------|--------|
| **accountingService.ts** | (1) **Idempotency helpers:** `hasExistingSaleAdjustmentByDescription(companyId, saleId, description)`, `hasExistingPaymentAmountAdjustment(companyId, paymentId, oldAmount, newAmount)`, `hasExistingPaymentAccountAdjustment(companyId, paymentId, oldAccountId, newAccountId, amount)`. (2) **Void filtering:** In `getAllEntries`, filter out rows where `is_void === true` (using `dataFiltered`). (3) In `getCustomerLedger`, include `is_void` in journal_entries select and exclude lines whose `journal_entry.is_void === true`. |
| **saleAccountingService.ts** | In `postAdjustmentJE`, before `createEntry`, call `accountingService.hasExistingSaleAdjustmentByDescription`. If a JE with the same sale_id and description exists, return without posting (idempotent). |
| **paymentAdjustmentService.ts** | In `postPaymentAmountAdjustment`, before creating JE, call `accountingService.hasExistingPaymentAmountAdjustment`; skip if exists. In `postPaymentAccountAdjustment`, call `accountingService.hasExistingPaymentAccountAdjustment`; skip if same transfer already posted. |
| **migrations/pf14_4_journal_entries_void_support.sql** | Add `is_void` (boolean, default false), `void_reason`, `voided_at`, `voided_by` to `journal_entries`. Index on (company_id, is_void) where is_void = false. |
| **scripts/pf14-4-classify-and-cleanup-journal-entries.sql** | PREVIEW: duplicate sale_adjustment/payment_adjustment by (reference_id, description); orphan sale_adjustment/payment_adjustment. APPLY (commented): void duplicates (keep first), void orphans. |
| **scripts/verify-pf14-4-idempotency-and-void.sql** | Verification: no duplicate (sale_id, description) or (payment_id, description) in non-void JEs; voided counts; total by type. |

---

## 3. Idempotency design

- **Sale adjustment:** One JE per (sale_id, description). Description is deterministic from old/new values (e.g. "Sale adjustment – discount change (was Rs X, now Rs Y) – SL-0004"). Before insert, `hasExistingSaleAdjustmentByDescription(companyId, saleId, description)`; if found, skip.
- **Payment amount adjustment:** One JE per (payment_id, oldAmount, newAmount). Match by description containing "was Rs X, now Rs Y" (with locale-tolerant fallback). Before insert, `hasExistingPaymentAmountAdjustment`; if found, skip.
- **Payment account adjustment:** One JE per (payment_id, oldAccountId, newAccountId, amount). Fetch existing payment_adjustment JEs for that payment with "Payment account changed", then check lines for (newAccountId debit = amount, oldAccountId credit = amount). Before insert, `hasExistingPaymentAccountAdjustment`; if found, skip.

**Result:** Repeated calls (double save, sync on every load, retries) do not create additional JEs for the same logical action.

---

## 4. Cleanup classification and strategy

- **VALID_LINKED:** reference_type/reference_id resolve, document exists, single JE per action → keep, show in business reports.
- **DUPLICATE_LINKED:** Same (reference_id, description) or same (payment_id, amount/account change) → void all but one (keep earliest by created_at).
- **ORPHAN_UNLINKED:** reference_id points to missing sale/payment → void with reason "orphan (sale/payment deleted)".
- **Void vs delete:** No hard delete of valid immutable entries. Only void (set `is_void = true`, `void_reason`, `voided_at`). Voided rows are excluded from `getAllEntries` and customer ledger; audit/raw views can still show them if needed.

---

## 5. Ledger/report filtering

- **getAllEntries:** Excludes rows where `is_void === true`. Journal list and reports that use this API no longer show voided entries.
- **getCustomerLedger:** Excludes journal_entry_lines whose parent journal_entry has `is_void === true`. Business customer ledger shows only non-voided JEs.
- **Migration required:** Run `migrations/pf14_4_journal_entries_void_support.sql` so `is_void` exists. Existing rows get default `is_void = false`. Code tolerates missing `is_void` (treats as non-void) for backward compatibility where column is not yet added.

---

## 6. Admin verification and cleanup

- **Preview duplicates:** Run PREVIEW sections in `scripts/pf14-4-classify-and-cleanup-journal-entries.sql` (duplicate sale_adjustment, duplicate payment_adjustment, orphan sale_adjustment, orphan payment_adjustment).
- **Apply void:** Uncomment and run the APPLY blocks in the same script (void duplicate sale_adjustment, void duplicate payment_adjustment, void orphan sale_adjustment, void orphan payment_adjustment). Replace `(SELECT id FROM companies LIMIT 1)` with your company id if needed.
- **Verify:** Run `scripts/verify-pf14-4-idempotency-and-void.sql` to confirm no duplicate (sale_id, description) or (payment_id, description) in non-void JEs and to see voided counts.

---

## 7. Global scope (same pattern for future)

The same idempotency pattern (check-before-insert by logical action key) and void-based cleanup can be applied to:

- Purchases (purchase adjustment, if any)
- Rentals, Studio, Expenses
- Worker payments
- Transfers / account moves
- Manual adjustment helpers

This task implemented idempotency and void support for **Sales** (sale_adjustment) and **Payments** (payment_adjustment amount + account).

---

## 8. Acceptance criteria

- Editing one logical document/action does not create 2, 3, or 4 duplicate adjustment JEs (idempotency guards in place).
- Account ledger and statements no longer show accidental duplicate rows (voided excluded; duplicates voided via script).
- Valid immutable accounting entries are preserved (no hard delete of valid JEs).
- Orphan/duplicate mistaken entries are voided via admin script; business reports use only non-voided entries.
- Audit trail remains intact (voided entries remain in DB with void_reason/voided_at).
