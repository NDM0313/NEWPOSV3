# Worker Ledger Duplicate Payment Fix – Deliverable

**Company scope (SQL):** `company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'`

**Business rule:** ONE REAL PAYMENT = ONE WORKER LEDGER PAYMENT ROW.

---

## 1. Exact duplication cause

- **Source of duplicates:** Multiple rows in `worker_ledger_entries` for the **same** journal-backed payment (same `reference_type = 'accounting_payment'`, same `reference_id` = journal entry id).
- **How they were created:**
  1. **App path:** Pay Worker or Manual Entry (Worker Payable) → `createEntry` (creates one journal) → `recordAccountingPaymentToLedger(journalEntryId)` → inserts one row with `reference_id = journal id`.
  2. **Duplicate insert:** `recordAccountingPaymentToLedger` was **not idempotent**. If the same sync ran twice for the same journal (e.g. retry path, double submit, or backfill running in a window where the app had already inserted), a second row with the same `(worker_id, reference_id)` was inserted. There was no “already exists” check before insert.
  3. **Backfill:** The repair/backfill SQL uses `NOT EXISTS (... reference_id = je.id ...)` so it does **not** insert when a row already exists for that journal. So backfill alone did not create duplicates; the app path could create a second row when the sync ran more than once for the same journal.
- **Why PAY0069 / JE-8405 / JE-0011 appear multiple times:** Each is a **payment reference** or **journal entry number** shown in the UI. If one journal (e.g. JE-8405) had two `worker_ledger_entries` rows (same `reference_id` = that journal’s id), the ledger showed two lines for the same payment. Similarly, if the same payment reference (e.g. PAY0069) was used for multiple separate payments (multiple dialogs), each would create its own journal and its own ledger row—those are distinct payments, not duplicates. The fix addresses **same journal → multiple ledger rows** (true duplicates).

---

## 2. Canonical payment-row design

- **Canonical source for worker payments in the ledger:** One row in `worker_ledger_entries` per **journal-backed** worker payment:
  - `reference_type = 'accounting_payment'`
  - `reference_id` = `journal_entries.id` (UUID of the journal entry)
  - Deterministic identity: `(company_id, worker_id, reference_type, reference_id)` is unique per real payment.
- **Job/earning rows** are unchanged: `reference_type = 'studio_production_stage'` (or `salary`), each with its own `reference_id` (stage id or expense id). No dedupe applied to those.
- **Rule:** Journal may have two lines (double entry); worker ledger must have **one** payment row per journal entry. No second row for the same journal.

---

## 3. Code changes

| File | Change |
|------|--------|
| **studioProductionService.ts** | `recordAccountingPaymentToLedger`: When `journalEntryId` is provided, **check for existing row** with same `(company_id, worker_id, reference_type, reference_id)`. If found, **return without inserting** and without updating `workers.current_balance` again (idempotent). |
| **ledgerDataAdapters.ts** | `getWorkerLedgerData`: **Dedupe** fetched rows by `(reference_type, reference_id)` before computing balances and transactions. Keeps first occurrence (order preserved from query). |
| **studioService.ts** | `getWorkerLedgerEntries`: **Dedupe** by `(reference_type, reference_id)` before returning, so Worker Detail / “View Full Ledger” never shows duplicate rows. |

---

## 4. SQL dedupe scripts

All in `scripts/worker_ledger_repair/`, company-scoped to `eb71d817-b87e-4195-964b-7b5321b480f5`. Only **payment** rows (`reference_type = 'accounting_payment'`) are considered; job/earning rows are untouched.

| Script | Purpose |
|--------|--------|
| **04_duplicate_detection_company.sql** | Read-only. Lists duplicate groups: same `(worker_id, reference_id)` with count > 1, with ids and amounts. |
| **05_duplicate_preview_company.sql** | Read-only. For each duplicate group, marks one row as KEEP (earliest `created_at`) and the rest as REMOVE. |
| **06_duplicate_cleanup_company.sql** | **DELETE** duplicate payment rows only. Keeps one row per `(worker_id, reference_id)` (earliest by `created_at`). Run 04 and 05 first to verify. |
| **07_verification_company.sql** | Read-only. After cleanup, should return 0 rows (no duplicate `(worker_id, reference_id)` for `accounting_payment`). |

Run order: **04 → 05 → 06 → 07**.

---

## 5. Verification query

- **After code deploy:** Record one worker payment (Pay Worker or Manual Entry with Worker Payable). Query `worker_ledger_entries` for that worker: there should be **one** row with `reference_type = 'accounting_payment'` and `reference_id` = the new journal entry id. Calling the sync twice (e.g. retry) should not create a second row.
- **After SQL cleanup:** Run **07_verification_company.sql**. Result should be **empty**. Run 04 again; duplicate groups should be **0**.

---

## 6. Rollback notes

- **Code:** Reverting the three files restores previous behaviour: no idempotency check (possible duplicate inserts) and no display dedupe. No DB migration is required to revert.
- **SQL (06):** The cleanup **deletes** duplicate rows only; it does not touch journal_entries or journal_entry_lines. Deleted rows are not recoverable unless you have a backup. To be safe, run 04 and 05 and store the “REMOVE” ids before running 06. If you need to “undo” cleanup, you would have to re-insert from backup; there is no automatic rollback script.
- **Scope:** All dedupe SQL is limited to the one company_id; other companies are unchanged. Only `worker_ledger_entries` rows with `reference_type = 'accounting_payment'` are ever deleted; job and salary rows are never deleted by these scripts.

---

**Summary:** Duplicates were caused by non-idempotent `recordAccountingPaymentToLedger` when the same journal was synced more than once. The fix is: idempotent insert (skip when row exists), display dedupe in both worker ledger data and worker ledger entries, and company-scoped SQL to detect, preview, and safely remove duplicate payment rows, with a verification query to confirm no remaining duplicates.
