# Worker Payment → Worker Ledger Fix – Deliverable Report

**Company scope:** `company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'`

---

## 1. Exact status of current issue

- **Symptom:** Worker payments appear in Journal / Day Book (journal_entries + journal_entry_lines with Dr Worker Payable) but do not appear in Worker Ledger (worker_ledger_entries). Worker Detail / “View Full Ledger” reads from worker_ledger_entries only, not from the journal.
- **Root causes addressed:**
  - **Code:** Manual Entry path could create journal rows without `metadata.workerId`, so journal had no worker link and sync to worker_ledger_entries was skipped. Pay Worker / Studio Pay Now paths already passed workerId.
  - **Data:** Some journal rows exist with `reference_type` in ('manual','payment'), `reference_id` null, and worker only in description text (e.g. “Payment to worker Shakeel”). No corresponding worker_ledger_entries were ever created.
- **Current status:** Code paths are fixed (Manual Entry enforces worker when Debit = Worker Payable; AccountingContext sets `reference_type = 'worker_payment'`, `reference_id = metadata.workerId`, and runs sync). **Remaining gap is historical/legacy data** for this company: existing journal rows that were never linked to a worker or never backfilled into worker_ledger_entries. Exact counts and whether any *new* failures still occur **must be confirmed by running the diagnosis SQL** (no DB access was used in this session).

---

## 2. Whether latest failure is new-data issue, old-data issue, or both

- **To be confirmed by running diagnosis SQL** (scripts/worker_ledger_repair/01_diagnosis_company.sql).
- **Expectation:**
  - **Old/legacy:** Many missing worker_ledger_entries will be for journal rows created before the code fix (reference_type manual/payment, reference_id null).
  - **New:** After the code and UI changes, new worker payments (Pay Worker, Studio Pay Now, Manual Entry with Worker Payable) should create both journal and worker_ledger_entries; if any new rows still miss the ledger, diagnosis query 3 will list them with `gap_reason`.
- **Conclusion:** Treat as **both** until diagnosis is run: fix code for all new data, repair/backfill for old data via the company-scoped SQL.

---

## 3. Files changed (code)

- **src/app/context/AccountingContext.tsx**
  - When Debit = Worker Payable and `metadata.workerId` is set: journal is saved with `reference_type = 'worker_payment'` and `reference_id = metadata.workerId`; sync to worker_ledger_entries is called after journal insert (main and retry paths).
  - Debug logs added: createEntry input, journal payload, insert result, worker ledger sync call, sync OK/fail, and a warning when Worker Payable debit but no `metadata.workerId`.
- **src/app/components/accounting/ManualEntryDialog.tsx**
  - When Debit account is Worker Payable: worker dropdown is shown (from studioService.getAllWorkers(companyId)), worker selection is required before save, and `metadata.workerId` / `metadata.workerName` are passed to createEntry.
- **src/app/services/studioProductionService.ts**
  - recordAccountingPaymentToLedger: debug logs added for params and insert result.
- **UnifiedPaymentDialog** (Pay Worker / Studio): already passed `entityId` as workerId into recordWorkerPayment, so no change required there.

---

## 4. SQL files created

| File | Purpose | Run where |
|------|--------|-----------|
| **scripts/worker_ledger_repair/01_diagnosis_company.sql** | Read-only: latest worker payment journals, latest worker_ledger_entries, and journal rows missing in ledger (with gap_reason). | Supabase SQL Editor |
| **scripts/worker_ledger_repair/02_repair_backfill_company.sql** | Company-scoped repair: (A) backfill worker_ledger_entries where journal has worker_payment + valid reference_id; (B) infer worker from description for legacy rows (unique name match), update journal reference_type/reference_id, then insert ledger; (C) SELECT ambiguous rows for manual review. | Supabase SQL Editor |
| **scripts/worker_ledger_repair/03_reconciliation_company.sql** | Read-only: journal missing in ledger, ledger missing journal, summary by worker/date, ambiguous legacy rows. | Supabase SQL Editor |

All three use **company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'** only. No DELETEs/DROPs/TRUNCATEs.

---

## 5. Repair strategy used

1. **Backfill when worker is already known**  
   For journal_entries with Dr Worker Payable, `reference_type = 'worker_payment'`, and `reference_id` in workers for this company: insert missing worker_ledger_entries (reference_type = 'accounting_payment', reference_id = journal id, worker_id = reference_id). Idempotent (NOT EXISTS so no duplicates).

2. **Legacy inference (description → worker)**  
   For rows with Dr Worker Payable and (reference_id null or not in workers), and no existing worker_ledger_entry:
   - Extract name from description using patterns: “Payment to worker X”, “worker payment X”, “Payment X to worker”.
   - Match workers for this company where name ILIKE the extracted name (or exact trim match).
   - If **exactly one** worker matches: UPDATE journal_entries SET reference_type = 'worker_payment', reference_id = worker_id; then the same backfill INSERT (in Step B2) adds the worker_ledger_entry.
   - If zero or multiple matches: do **not** guess; leave for manual review.

3. **Ambiguous output**  
   Step C in 02_repair_backfill_company.sql and section 4 in 03_reconciliation_company.sql list journal rows that still have no worker_ledger_entry and no unique worker inference. Manual action: set journal_entries.reference_type = 'worker_payment' and reference_id = &lt;worker_id&gt;, then re-run the backfill INSERT (or full 02 script).

---

## 6. Ambiguous rows that still need manual review

- **Source:** Run **02_repair_backfill_company.sql** (Step C SELECT) or **03_reconciliation_company.sql** (query 4). Rows returned are Dr Worker Payable journal entries with no worker_ledger_entry and no unique worker inferred from description.
- **Action:** For each row, decide the correct worker, then:
  - `UPDATE journal_entries SET reference_type = 'worker_payment', reference_id = '<worker_id>' WHERE id = '<journal_entry_id>';`
  - Re-run 02_repair_backfill_company.sql (or at least the B2 INSERT block) to create the worker_ledger_entry.
- No automatic guess when multiple workers match the same name or description is unclear.

---

## 7. Verification steps

1. **Diagnosis (read-only)**  
   Run **01_diagnosis_company.sql** in Supabase SQL Editor. Check query 3 result: list of journal rows missing in worker_ledger_entries and their `gap_reason`.

2. **Repair**  
   Run **02_repair_backfill_company.sql**. Check that INSERTs affect the expected number of rows. Run the Step C SELECT and note any ambiguous rows.

3. **Reconciliation**  
   Run **03_reconciliation_company.sql**. Expect:
   - Query 1: empty or only ambiguous/legacy rows you chose not to infer.
   - Query 2: ideally empty (no orphan ledger entries).
   - Query 3: no MISMATCH / only expected differences you’re handling manually.
   - Query 4: list of ambiguous rows for manual review.

4. **App behaviour**  
   - Create a new worker payment via Pay Worker, Studio Pay Now, and Manual Entry (Debit = Worker Payable). Confirm in DB: one new journal entry with reference_type = 'worker_payment', reference_id = worker id, and one new worker_ledger_entry with reference_type = 'accounting_payment', reference_id = journal id.
   - Check Worker Detail / View Full Ledger for that worker; the new payment should appear.

5. **Debug logs**  
   In browser console, confirm logs: createEntry input, journal insert result, worker ledger sync start, sync OK/fail; and warning when Worker Payable debit but no metadata.workerId.

---

## 8. Risks / rollback notes

- **Repair script (02):** Only INSERTs into worker_ledger_entries and UPDATEs journal_entries (reference_type, reference_id). No DELETE/TRUNCATE. Re-running is idempotent for backfill (NOT EXISTS prevents duplicate ledger rows). If you need to undo an inferred worker: UPDATE journal_entries SET reference_type = 'manual', reference_id = NULL WHERE id = ?; then delete the corresponding worker_ledger_entries row(s) where reference_id = that journal id (only if you want to fully revert that repair).
- **Code:** Reverting the AccountingContext/ManualEntryDialog changes would restore the previous behaviour (possible missing workerId and no sync for Manual Entry when Worker Payable). No DB migration is required to revert code.
- **Scope:** All repair SQL is limited to company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'; other companies are untouched.
- **Double-entry:** Repair does not change journal_entry_lines or amounts; it only links journal to worker and mirrors the payment in worker_ledger_entries. Accounting integrity is preserved.

---

**Summary:** Code paths are fixed and company-scoped diagnosis, repair (with safe legacy inference), and reconciliation SQL are in place. Run 01 → 02 → 03 in order; handle ambiguous rows manually and re-run 02’s backfill as needed. Verify with 03 and with new payment flows in the app.
