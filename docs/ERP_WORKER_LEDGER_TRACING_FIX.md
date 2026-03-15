# Worker Payment Journal → Ledger Tracing Fix

**Date:** 2026-03-14  
**Issue:** Worker payment amount visible in Roznamcha/Journal (Day Book) but NOT in the corresponding user/worker ledger.

---

## Exact cause of latest failing entry

The most likely failure path is **Manual Entry** when the user debits Worker Payable and credits Cash (e.g. "Payment to worker Shakeel") but **does not select a worker**:

1. **Path:** Accounting → Manual Journal Entry → Debit = Worker Payable, Credit = Cash, amount, description.
2. **Payload:** ManualEntryDialog called `createEntry(..., metadata: {})` — **metadata.workerId was never set** (no worker selector in the UI).
3. **AccountingContext:** Because `entry.metadata?.workerId` was missing, `isWorkerPayment` was false, so journal was saved with `reference_type = 'manual'`, `reference_id = null`. The sync block (`if (entry.debitAccount === 'Worker Payable' && entry.metadata?.workerId && companyId)`) did not run.
4. **Result:** One row in `journal_entries` (and two in `journal_entry_lines`: Dr Worker Payable, Cr Cash). Zero rows in `worker_ledger_entries`. Day Book shows the entry; worker ledger does not.

**Conclusion:** **metadata.workerId missing** → sync never fired → worker_ledger_entries not populated. Not a duplicate constraint, RLS, or wrong worker_id; the insert path was never called.

---

## 1. Schema discovered

### Journal (double-entry)

| Table | Key columns |
|-------|-------------|
| **journal_entries** | id, company_id, branch_id, entry_no, entry_date, description, **reference_type**, **reference_id**, payment_id, created_by, created_at |
| **journal_entry_lines** | id, journal_entry_id, **account_id**, debit, credit, description |
| **accounts** | id, company_id, code, name, type, balance, contact_id (optional), parent_id (optional) |

- Worker Payable account: `accounts` with `name ILIKE '%Worker Payable%'` or `code IN ('2010','2100')`. Single control account per company in current setup.
- No `entry_number`; voucher display uses `entry_no` (e.g. JE-xxxx).

### Worker ledger (per-worker sub-ledger)

| Table | Key columns |
|-------|-------------|
| **worker_ledger_entries** | id, company_id, **worker_id**, amount, reference_type, reference_id, status, paid_at, payment_reference, notes, document_no, entry_type |

- Worker ledger UI (Worker Detail → View Full Ledger) reads **only** from `worker_ledger_entries` filtered by `worker_id`.
- No automatic link from journal to this table unless we insert a row when a worker payment is posted.

### Ledger master / ledger_entries (supplier/user)

- **ledger_master**: ledger_type IN ('supplier', 'user'), entity_id = supplier or user UUID.
- **ledger_entries**: ledger_id, entry_date, debit, credit, source, reference_no, reference_id, remarks.
- Not used for workers; workers use **worker_ledger_entries**.

---

## 2. Posting flow discovered

### Where “Payment to worker Shakeel” journal is created

1. **Accounting → Manual Entry**  
   User selects Debit = Worker Payable, Credit = Cash, amount, description “Payment to worker Shakeel”.  
   - **ManualEntryDialog** calls `accounting.createEntry({ source: 'Manual', metadata: {} })`.  
   - So **metadata.workerId is never set**; journal is saved with `reference_type = 'manual'`, `reference_id = null`.

2. **Accounting → Pay Worker** (or Studio pay flow)  
   - **recordWorkerPayment** in AccountingContext calls `createEntry({ source: 'Payment', metadata: { workerId, workerName, stageId? } })`.  
   - Journal was saved with `reference_type = entry.source.toLowerCase()` = `'payment'`, and `reference_id = entry.metadata?.saleId || ... || null` — **workerId was never written to reference_id**.  
   - Sync to worker_ledger_entries ran only when `entry.source === 'Payment' && entry.metadata?.workerId && !entry.metadata?.stageId`, so Studio payments with stageId skipped the sync.

### Account resolution

- Debit/Credit account resolved by name/code via **defaultAccountsService** / account lookup (Worker Payable = 2010 / name match).
- Single Worker Payable **control** account; no per-worker accounts in chart of accounts.

### Posting service

- **accountingService.createEntry(journalEntry, lines, paymentId?)** inserts into `journal_entries` then `journal_entry_lines`.  
- It does **not** write to `worker_ledger_entries`; that was done in **AccountingContext** after createEntry, only when conditions above were met.

---

## 3. Roznamcha query path

- **RoznamchaReport** (cash book) uses **roznamchaService**: reads from **payments** (cash in/out), not from journal. So “Roznamcha” in the issue is the **Day Book / Journal** view.
- **Day Book (Journal) view**: **DayBookReport.tsx** loads from `journal_entries` with embedded `journal_entry_lines` and `accounts(name)`.  
- Query: `journal_entries` filtered by company_id and entry_date range; each line shows account name, debit, credit, description.  
- So any posted worker payment (Dr Worker Payable, Cr Cash) **appears here** because it exists in journal_entries + journal_entry_lines.

---

## 4. Ledger query path

- **Account Ledger** (Chart of Accounts → click Worker Payable): **accountingService.getAccountLedger(accountId, ...)**.  
  - Reads **journal_entry_lines** for that account_id with joined journal_entries.  
  - So the **Worker Payable account** ledger does show the 1500 debit line; the issue is not here.

- **Worker ledger** (Worker Detail → View Full Ledger / “user ledger” for that worker): **ledgerDataAdapters.getWorkerLedgerData(companyId, workerId, ...)**.  
  - Reads **only** from `worker_ledger_entries` where `worker_id = workerId`.  
  - If no row was inserted for this payment, the worker ledger **misses** it.

So: **Journal shows it** (journal_entries + journal_entry_lines). **Worker ledger misses it** because it only shows **worker_ledger_entries**, and we were not inserting a row there for every worker payment journal.

---

## 5. Root cause

| Item | Detail |
|------|--------|
| **Actual tables** | journal_entries, journal_entry_lines, accounts, worker_ledger_entries |
| **Actual columns** | journal_entries.reference_type, journal_entries.reference_id; worker_ledger_entries.worker_id, reference_type, reference_id |
| **Exact broken condition** | (1) Journal never stored worker identity: reference_id was only set from saleId/purchaseId/expenseId/bookingId, not workerId. (2) Sync to worker_ledger_entries only when source === 'Payment' and !stageId, and (3) Manual entries have no metadata.workerId so sync never ran. |
| **Why journal shows it** | Day Book reads journal_entries + journal_entry_lines; the entry exists there. |
| **Why ledger misses it** | Worker ledger reads only worker_ledger_entries; no row was inserted for this payment. |
| **Category** | **Posting/sync issue**: we do not consistently write to worker_ledger_entries when a worker payment is posted to the journal, and we did not store worker_id on the journal for traceability/backfill. |

---

## 6. Exact fix applied

1. **Journal stores worker when known**  
   In **AccountingContext** when building the journal entry for createEntry:  
   - If `entry.debitAccount === 'Worker Payable'` and `entry.metadata?.workerId`, set  
     - `reference_type = 'worker_payment'`  
     - `reference_id = entry.metadata.workerId`  
   so the journal row is traceable to the worker and backfill can use it.

2. **Sync to worker_ledger_entries whenever worker is known**  
   - After createEntry, if `entry.debitAccount === 'Worker Payable'` and `entry.metadata?.workerId` and companyId, call **studioProductionService.recordAccountingPaymentToLedger(...)**.  
   - Removed the condition `entry.source === 'Payment' && !entry.metadata?.stageId` so we sync for any worker payment (manual with worker selected, Pay Worker, or Studio with stage).

3. **Retry path** (when default accounts are created and entry is retried): same journal reference_type/reference_id and same sync condition applied.

4. **Backfill**  
   - New migration **worker_ledger_sync_from_journal_backfill.sql**: idempotent insert into worker_ledger_entries from journal_entries where reference_type = 'worker_payment', reference_id = worker id, debit line to Worker Payable, and no matching worker_ledger_entry yet.  
   - Existing **backfill_worker_ledger_from_journal.sql** already supports reference_type IN ('payment', 'test_worker_payment', 'worker_payment'); with the new reference_type, new entries will be picked up. For old entries that already have reference_type = 'worker_payment' and reference_id set, the new migration backfills them.

---

## 7. SQL verification queries

Use in Supabase SQL Editor (replace dates/ids as needed).

```sql
-- 1) Journal tables/columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'journal_entries'
ORDER BY ordinal_position;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'journal_entry_lines'
ORDER BY ordinal_position;

-- 2) Find worker payment journals (after fix: reference_type = 'worker_payment', reference_id = worker id)
SELECT je.id, je.entry_no, je.entry_date, je.description, je.reference_type, je.reference_id
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN accounts a ON a.id = jel.account_id AND (a.name ILIKE '%Worker Payable%' OR a.code IN ('2010','2100'))
WHERE jel.debit > 0
  AND je.reference_type IN ('worker_payment', 'payment', 'test_worker_payment')
ORDER BY je.entry_date DESC, je.created_at DESC
LIMIT 20;

-- 3) Lines for a specific journal (replace JOURNAL_ENTRY_ID)
SELECT jel.id, jel.account_id, a.name AS account_name, jel.debit, jel.credit, jel.description
FROM journal_entry_lines jel
JOIN accounts a ON a.id = jel.account_id
WHERE jel.journal_entry_id = 'JOURNAL_ENTRY_ID';

-- 4) Worker ledger entries for a worker (replace WORKER_ID)
SELECT id, amount, reference_type, reference_id, status, paid_at, payment_reference, notes
FROM worker_ledger_entries
WHERE worker_id = 'WORKER_ID'
ORDER BY paid_at DESC, created_at DESC;

-- 5) Compare: journal-visible vs ledger-visible for one worker
-- Journal side (replace WORKER_ID and company_id)
SELECT je.id AS je_id, je.entry_no, je.entry_date, jel.debit, je.reference_type, je.reference_id
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN accounts a ON a.id = jel.account_id AND (a.name ILIKE '%Worker Payable%' OR a.code IN ('2010','2100'))
WHERE je.company_id = 'YOUR_COMPANY_ID' AND jel.debit > 0
  AND (je.reference_id = 'WORKER_ID' OR je.reference_type = 'worker_payment');
-- Ledger side
SELECT id, amount, reference_type, reference_id, status, paid_at
FROM worker_ledger_entries
WHERE company_id = 'YOUR_COMPANY_ID' AND worker_id = 'WORKER_ID'
ORDER BY paid_at DESC;
```

---

## 8. Files changed

| File | Change |
|------|--------|
| **src/app/context/AccountingContext.tsx** | (1) When debitAccount === 'Worker Payable' and metadata.workerId, set journal reference_type = 'worker_payment' and reference_id = metadata.workerId (main and retry paths). (2) Sync to worker_ledger_entries whenever Worker Payable debit and metadata.workerId (removed source === 'Payment' and !stageId). (3) sourceMap: 'worker_payment' → 'Payment'. (4) **[WORKER LEDGER DEBUG]** console logs: createEntry input, journal payload, journal insert result, sync call, sync OK/fail, and warning when Worker Payable debit but no metadata.workerId. |
| **src/app/services/studioProductionService.ts** | **recordAccountingPaymentToLedger:** **[WORKER LEDGER DEBUG]** log params and worker_ledger_entries insert result (id/error). Insert now uses .select('id').maybeSingle() for logging. |
| **src/app/components/accounting/ManualEntryDialog.tsx** | (1) When Debit = Worker Payable: optional worker selector (load workers via studioService.getAllWorkers). (2) Worker selection **required** before save when debit is Worker Payable. (3) Pass metadata.workerId and metadata.workerName to createEntry so sync runs and journal gets reference_type=worker_payment, reference_id=workerId. |
| **migrations/worker_ledger_sync_from_journal_backfill.sql** | New idempotent backfill from journal_entries (reference_type = 'worker_payment') into worker_ledger_entries. |
| **docs/ERP_WORKER_PAYMENT_RECONCILIATION.sql** | New: reconciliation queries (journal missing in ledger, ledger without journal, summary by worker/date). Replace YOUR_COMPANY_ID. |
| **docs/ERP_DB_CLEANUP_AUDIT_PLAN.md** | New: audit-only plan (unused/duplicate/test tables, code refs, safe-delete candidates, archive-first). No deletion. |
| **docs/ERP_WORKER_LEDGER_TRACING_FIX.md** | This document. |

---

## 9. Migration added

- **migrations/worker_ledger_sync_from_journal_backfill.sql**  
  - Inserts into worker_ledger_entries from journal_entries where reference_type = 'worker_payment', reference_id is a valid worker id, debit line is Worker Payable, and no matching worker_ledger_entry exists.  
  - Safe to run multiple times (NOT EXISTS guard).  
  - Run once after deploy to backfill existing worker_payment journals that already have reference_id set; for journals created after the code fix, sync happens at post time.

## 10. UI change for Manual Entry

- When **Debit account = Worker Payable**, the Manual Entry dialog now shows a **required Worker** dropdown (loaded from studioService.getAllWorkers).
- User must select a worker before saving. Submitting without a worker when debit is Worker Payable shows: "When debiting Worker Payable, you must select the worker so the payment appears in their ledger."
- Selected worker is passed as metadata.workerId and metadata.workerName so the journal is stored with reference_type = 'worker_payment', reference_id = workerId, and the worker_ledger_entries sync runs.

## 11. Reconciliation query

- **docs/ERP_WORKER_PAYMENT_RECONCILIATION.sql** contains three read-only queries (replace YOUR_COMPANY_ID):
  1. Worker payments in journal but missing in worker_ledger_entries.
  2. worker_ledger_entries rows (accounting_payment) with no matching journal_entries row.
  3. Summary by worker and date (journal vs ledger counts, status MISMATCH/OK).

## 12. Cleanup audit plan (no deletion)

- **docs/ERP_DB_CLEANUP_AUDIT_PLAN.md**: Lists candidate unused/duplicate/test tables, code reference check method, safe-delete candidates (none recommended until verification), and archive-first recommendations (e.g. sale_items vs sales_items, studio_orders). No DROP or TRUNCATE in this step.

---

## 13. Risk / backward compatibility

- **Double-entry:** Unchanged; only journal_entries and worker_ledger_entries are affected.  
- **Company/branch:** Unchanged; company_id and branch_id still applied.  
- **RLS:** No change to RLS; worker_ledger_entries and journal_entries policies unchanged.  
- **Existing data:** Journals created before the fix have reference_type = 'payment' or 'manual' and often reference_id = null. The new backfill only considers reference_type = 'worker_payment'. To backfill older entries you would need to run the existing **backfill_worker_worker_ledger_from_journal.sql** which also allows reference_type IN ('payment', 'test_worker_payment', 'worker_payment') but requires reference_id to be a valid worker id (so only old entries that already had reference_id set will be backfilled). For truly old manual entries with no worker id in DB, manual correction or a one-off script that infers worker from description would be needed.  
- **Manual entry without worker:** If the user does a manual Dr Worker Payable / Cr Cash and does **not** select a worker (no UI for it today), metadata.workerId remains unset and worker_ledger_entries will still not get a row. Extending Manual Entry to optionally select a worker and pass metadata.workerId would fix that; not done in this pass.

---

## Summary

- **Cause:** Worker payment was only in journal; worker ledger is a separate table and was not consistently updated, and the journal did not store worker_id.  
- **Fix:** Store worker on the journal (reference_type = 'worker_payment', reference_id = workerId) and always sync to worker_ledger_entries when workerId is present; add idempotent backfill for existing worker_payment journals.  
- **Verification:** Use the SQL above to confirm journal rows and worker_ledger_entries rows for a given worker; after fix and backfill, payments visible in Day Book should also appear in that worker’s ledger.
