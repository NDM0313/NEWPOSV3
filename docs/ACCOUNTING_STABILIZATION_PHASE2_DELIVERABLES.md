# Accounting Stabilization Phase 2 – Deliverables

**Company:** `company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'`  
**Focus:** Worker payment canonicalization and Roznamcha alignment. No table deletes, no broad cleanup.

---

## 1. Root cause of repeated PAY refs

- **Cause 1 – Job rows carrying PAY ref:** `markStageLedgerPaid(stageId, paymentReference)` was updating the **job** row (`reference_type = 'studio_production_stage'`) with `payment_reference`. So the same PAY ref appeared on both (1) the **payment** row in `worker_ledger_entries` (`reference_type = 'accounting_payment'`) and (2) the **job** row. Rule: only `accounting_payment` rows may have `payment_reference`; job rows must not.
- **Cause 2 – No single canonical path:** Worker payment was implemented as journal + worker_ledger only (via `createEntry` + `recordAccountingPaymentToLedger`). The PAY ref was generated in the dialog and passed through; there was no single service that created payment + journal + ledger together, so ref reuse or multiple ledger rows sharing a ref could occur depending on flow and retries.
- **Fix:** (1) `markStageLedgerPaid` now always sets `payment_reference = null` on job rows (no longer accepts/writes PAY ref there). (2) One canonical service `workerPaymentService.createWorkerPayment` now creates payment ref → payments row → journal → worker_ledger_entries; all worker payment entry points use it when `paymentAccountId` is provided.

---

## 2. Root cause of Roznamcha missing worker payments

- **Cause:** Roznamcha is **payments-only**. Worker payments were **never** inserting a row into `payments`. The flow only created a journal entry and a `worker_ledger_entries` row. So Roznamcha had nothing to show for worker payments.
- **Fix:** The canonical worker payment service now **always** inserts a row into `payments` with `reference_type = 'worker_payment'`, `payment_type = 'paid'`, and the same `reference_number` (PAY-xxxx). Roznamcha’s query does not filter by `reference_type`; it shows all payments for the company/branch/date. Added `worker_payment` to `getTypeLabel` in roznamchaService so the row displays as “Worker Payment”.

---

## 3. Canonical worker payment flow implemented

- **Service:** `src/app/services/workerPaymentService.ts` – `createWorkerPayment(params)`.
  - Gets payment ref from `documentNumberService.getNextDocumentNumber(companyId, branchId, 'payment')` (fallback to `generatePaymentReference` on error).
  - Inserts into **payments** (`reference_type: 'worker_payment'`, `reference_id: workerId`, `payment_type: 'paid'`).
  - Creates **journal entry** (Dr Worker Payable, Cr Cash/Bank) with `payment_id` set.
  - Inserts/updates **worker_ledger_entries** payment row via `recordAccountingPaymentToLedger` with `payment_reference` and `journalEntryId`.
  - For Pay Now full: calls `markStageLedgerPaid(stageId, null)` so job row is marked paid but **does not** get a PAY ref.
  - Returns `{ paymentId, journalEntryId, referenceNumber }`.
- **Entry points using the helper:**
  - **UnifiedPaymentDialog** (context = worker): passes `paymentAccountId: selectedAccount`; calls `accounting.recordWorkerPayment(...)`. When `paymentAccountId` is set, `recordWorkerPayment` calls `createWorkerPayment` (canonical path).
  - **AccountingContext.recordWorkerPayment**: if `companyId`, `workerId`, and `paymentAccountId` are present, uses `createWorkerPayment`; otherwise falls back to journal + ledger only (no payments row).
- **Contamination fix:** `markStageLedgerPaid` no longer writes `payment_reference` to the job row; it sets `payment_reference = null` for `studio_production_stage` rows.

---

## 4. Files changed

| File | Change |
|------|--------|
| `src/app/services/workerPaymentService.ts` | **New.** Canonical createWorkerPayment: payment ref → payments insert → journal → worker_ledger. |
| `src/app/context/AccountingContext.tsx` | recordWorkerPayment: when paymentAccountId present, call createWorkerPayment; return `{ referenceNumber }` for canonical path. WorkerPaymentParams: add paymentAccountId, referenceNo optional. |
| `src/app/components/shared/UnifiedPaymentDialog.tsx` | Worker case: pass paymentAccountId (selectedAccount); remove local PAY ref generation; handle result as object with referenceNumber. Remove unused documentNumberService import. |
| `src/app/services/studioProductionService.ts` | markStageLedgerPaid: always set payment_reference = null on job rows (studio_production_stage). |
| `src/app/services/roznamchaService.ts` | getTypeLabel: add `worker_payment: 'Worker Payment'`. |

---

## 5. SQL files created

| File | Purpose |
|------|--------|
| `docs/audit/worker_payment_canonical_audit.sql` | Latest worker payments in payments, journal_entries, worker_ledger_entries; join of payment → journal → ledger. |
| `docs/audit/roznamcha_worker_payment_gap.sql` | Journal/ledger worker payments that have no matching payments row (gap for Roznamcha). |
| `docs/audit/worker_ledger_payment_reference_cleanup_preview.sql` | Preview: job rows (studio_production_stage) that have payment_reference set (contamination). |
| `docs/audit/worker_ledger_payment_reference_cleanup_apply.sql` | Safe company-scoped UPDATE: set payment_reference = null on studio_production_stage rows only. |

---

## 6. Cleanup preview summary

- **Preview query:** `worker_ledger_payment_reference_cleanup_preview.sql` lists all `worker_ledger_entries` where `reference_type = 'studio_production_stage'` and `payment_reference IS NOT NULL`. These are job rows that incorrectly carried a PAY ref.
- **Apply script:** `worker_ledger_payment_reference_cleanup_apply.sql` runs `UPDATE worker_ledger_entries SET payment_reference = NULL WHERE company_id = ... AND reference_type = 'studio_production_stage' AND payment_reference IS NOT NULL`. No deletes; only nulling the column on job rows. Payment rows (`accounting_payment`) are unchanged.

---

## 7. Verification checklist

- [ ] Run `docs/audit/worker_payment_canonical_audit.sql`: confirm worker payments appear in payments (reference_type = worker_payment), journal_entries (reference_type = worker_payment, payment_id set), and worker_ledger_entries (reference_type = accounting_payment, payment_reference = PAY-xxxx).
- [ ] Run `docs/audit/roznamcha_worker_payment_gap.sql`: after new flow, new worker payments should not appear in the gap (journal/ledger with no payments row). Existing old entries may still appear until backfilled or accepted as legacy.
- [ ] Run `docs/audit/worker_ledger_payment_reference_cleanup_preview.sql`: note how many job rows have payment_reference set.
- [ ] Run `docs/audit/worker_ledger_payment_reference_cleanup_apply.sql` (after approving preview): re-run preview to confirm 0 job rows with payment_reference.
- [ ] Record a new worker payment from Unified Payment Dialog (worker context) with an account selected: confirm one row in payments (worker_payment), one journal entry with payment_id, one worker_ledger_entries row (accounting_payment) with that PAY ref; Roznamcha shows the row as “Worker Payment”.
- [ ] Pay Now (stage) full payment: confirm job row (studio_production_stage) does not get payment_reference; only the accounting_payment ledger row has the PAY ref.

---

## 8. What should be the next phase after this

- **Backfill (optional):** For existing worker payments that have journal + worker_ledger but no payments row, consider a one-off script that inserts a `payments` row (reference_type = worker_payment) from the journal/ledger data so they appear in Roznamcha. Requires care (unique reference_number, payment_date, amount, payment_account_id from journal lines).
- **Manual Entry worker payments:** Currently, when the user creates a manual entry with debit Worker Payable and credit Cash and selects a worker in metadata, the fallback path (no paymentAccountId) still only creates journal + worker_ledger. To make those show in Roznamcha, either (1) require “Pay Worker” to always go through the dialog (with account), or (2) extend Manual Entry to accept payment account and call createWorkerPayment when Worker Payable + worker metadata are present.
- **Refund/credit note/return numbering:** Phase 1 marked document_sequences as legacy; Phase 2 did not migrate those flows. Next phase could migrate them to `generate_document_number` / erp_document_sequences.
- **Studio Costs report:** Align with ACCOUNTING_SOURCE_LOCK.md so “payment side” (worker_payment journal lines and worker_ledger accounting_payment) is clearly included where specified.
