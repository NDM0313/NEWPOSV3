# Canonical Payment Posting Fix

**Company:** `eb71d817-b87e-4195-964b-7b5321b480f5`

## 1. Exact root cause by path

| Path | Root cause |
|------|------------|
| **Accounting Test Page (transfer)** | `testAccountingService.createTransfer` called `accountingService.createEntry(entry, lines)` with no `paymentId` and `reference_type: 'test_transfer'`. Money moved between payment accounts (e.g. 1011 NDM ↔ 1001 CASH) but no `payments` row was created, so Roznamcha (payments-only) did not show it. |
| **Accounting Test Page (worker payment)** | `testAccountingService.createWorkerPayment` created JE with `reference_type: 'test_worker_payment'` and no `paymentId`. Worker Payable ↔ Cash movement had no `payments` row. |
| **Accounting Test Page (supplier / expense / customer receipt / manual)** | Same pattern: JE-only with `test_supplier_payment`, `test_expense`, `test_customer_receipt`, or `test_manual` and no `paymentId`. |
| **Expense “mark as paid”** | `recordExpense` called `createEntry` with `source: 'Expense'` and did not create a `payments` row. Only Manual entries had the “if payment account → create payment” logic. So expense payments (Dr Expense Cr Cash) were JE-only and never appeared in Roznamcha. |
| **Manual entry (Day Book)** | Already correct: when one side was a payment account, a `payments` row was created and `paymentId` passed to `createEntry`. |

**Summary:** The posting layer allowed journal-only paths for cash/bank/wallet movements. Test page used `test_*` reference types and never created `payments`; expense flow never created `payments` for the “mark as paid” path.

---

## 2. Files changed

| File | Change |
|------|--------|
| `src/app/context/AccountingContext.tsx` | (1) `recordExpense`: pass `metadata: { expenseId }`. (2) In `createEntry`, when `entry.source === 'Expense'` and credit is a payment account, create `payments` row (`reference_type: 'expense'`, `reference_id: expenseId`) and link `paymentId`. (3) Moved `debitIsPayment` / `creditIsPayment` outside Manual block for reuse. |
| `src/app/services/testAccountingService.ts` | (1) All create methods now use canonical flows: create `payments` row when a payment account is involved and pass `paymentId` to `createEntry`; use `reference_type`: `manual_payment`, `manual_receipt`, `expense`, `worker_payment`, `on_account`, and for supplier/worker call `createSupplierPayment` / `createWorkerPayment`. (2) No new JEs use `test_transfer`, `test_worker_payment`, `test_supplier_payment`. (3) Helpers: `isPaymentAccountId`, `getNextPaymentRef`. |
| `src/app/services/accountingService.ts` | Comment on `createEntry`: when entry touches Cash/Bank/Wallet, callers must create a `payments` row and pass `paymentId`. |

---

## 3. SQL files created (under `docs/audit/`)

| File | Purpose |
|------|--------|
| `remaining_money_movement_without_payment_id.sql` | Lists all JEs that touch a payment account and have `payment_id` NULL. |
| `expense_payment_gap.sql` | JEs with `reference_type` expense-like and no `payment_id` (expense payment gap). |
| `manual_payment_gap.sql` | JEs with manual-like / test_transfer / test_manual and no `payment_id`. |
| `worker_payment_gap.sql` | JEs with worker_payment / test_worker_payment and no `payment_id`. |
| `canonical_payment_posting_verification.sql` | Verification: (A) count of JEs touching payment account with `payment_id` NULL, (B) count of JEs with `test_*` reference_type, (C) count of payments with non-canonical `reference_type`. |

All are company-scoped to `eb71d817-b87e-4195-964b-7b5321b480f5`.

---

## 4. Verification steps

1. **Run verification SQL**  
   Execute `docs/audit/canonical_payment_posting_verification.sql`. After fix (and after backfill for existing rows):  
   - “JEs touching payment account with payment_id NULL” = 0 (or only pre-fix rows).  
   - “JEs with test_* reference_type” = unchanged legacy count; no *new* test_* from posting.  
   - “Payments with non-canonical reference_type” = 0.

2. **New flows**  
   - **Transfer (Test page):** Create an account transfer (e.g. 1011 → 1001). Expect: one `payments` row (`manual_payment`), one JE with `payment_id` set, entry in Roznamcha.  
   - **Worker payment (Test page):** Create worker payment. Expect: one `payments` row (`worker_payment`), one JE with `payment_id`, Roznamcha and worker ledger.  
   - **Expense “mark as paid”:** Mark an expense as paid. Expect: one `payments` row (`expense`), one JE with `payment_id`, entry in Roznamcha.  
   - **Manual entry (Day Book):** Manual entry with Cash/Bank on one side. Expect: unchanged behavior (payment + JE + Roznamcha).

3. **Gap audits**  
   Run `remaining_money_movement_without_payment_id.sql`, `expense_payment_gap.sql`, `manual_payment_gap.sql`, `worker_payment_gap.sql` to list remaining gaps (should shrink to zero for new data after backfill).

---

## 5. Whether old historical rows need one-time backfill

**Yes.** Existing JEs that touch a payment account but have `payment_id` NULL (e.g. JE-8434, JE-8435, EXP-0017–EXP-0019, and other listed entries) will not appear in Roznamcha until they are linked to a payment.

**Options:**

1. **Use existing Phase 4 backfill**  
   `docs/audit/legacy_manual_payment_backfill_apply.sql` already backfills *manual* JEs (reference_type in `manual`, `manual_receipt`, `manual_payment`) that touch a payment account and have no `payment_id`. Run it (or extend it) for the company. It does **not** cover `test_transfer`, `test_worker_payment`, `test_expense`, or `expense` reference types.

2. **Extended backfill (recommended)**  
   Add (or run) a one-time script that:  
   - Finds all JEs for the company that touch a payment account and have `payment_id` NULL (same definition as `remaining_money_movement_without_payment_id.sql`).  
   - For each: INSERT a `payments` row with appropriate `reference_type` (e.g. map `test_transfer` → `manual_payment`, `test_worker_payment` → `worker_payment`, `test_expense` / `expense` → `expense`, etc.) and UPDATE `journal_entries` SET `payment_id` = new payment id.  
   - Use a consistent reference number pattern (e.g. `PAY-BACKFILL-<journal_entry_id>`) and same company/branch/amount/date rules as the manual backfill.

3. **Leave old rows as-is**  
   Do not backfill; only new postings will follow the canonical rule. Old JE-8434 / JE-8435 style entries will remain missing from Roznamcha until an extended backfill is run.

**Recommendation:** Run the existing manual backfill for manual/manual_receipt/manual_payment, then add and run an extended backfill for `test_*` and `expense` JEs that touch a payment account so all historical money movements appear in Roznamcha.
