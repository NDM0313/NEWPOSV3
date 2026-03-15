# Accounting Stabilization Phase 4 – Deliverables

Company: `eb71d817-b87e-4195-964b-7b5321b480f5`

---

## 1. What old bad data was found

- **Legacy duplicate supplier payment journals:** Standalone journal entries with `reference_type = 'purchase'` and `payment_id IS NULL` that duplicate a canonical payment-linked JE (same `reference_id`, same `entry_date`, same amount). These were created by the old flow that called `recordSupplierPayment` after `recordPayment`, producing two JEs per payment.
- **Contaminated worker ledger payment_reference:** Rows in `worker_ledger_entries` with `reference_type = 'studio_production_stage'` (job/stage rows) that had `payment_reference` set. Only `accounting_payment` rows should carry a PAY ref; job rows must not.
- **Manual payment/receipt Roznamcha gap:** Manual journal entries (reference_type manual/manual_receipt/manual_payment) that involve a payment account (Cash/Bank/Wallet) in one line but have **no** linked `payments` row (`payment_id IS NULL`), so they did not appear in Roznamcha.

---

## 2. What was cleaned

- **Supplier payment duplicates:** Applied **mark-only** cleanup: appended ` [LEGACY DUPLICATE - canonical JE has payment_id]` to the **description** of the duplicate standalone Purchase JEs. No rows deleted. Canonical JEs (with `payment_id` set) unchanged.
- **Worker ledger:** Applied cleanup: set `payment_reference = NULL` on `worker_ledger_entries` where `reference_type = 'studio_production_stage'` and `payment_reference` was non-empty. No deletes.
- **Manual payment backfill:** For manual JEs that have a payment account in their lines but no `payment_id`, the apply script **inserts** a row into `payments` (reference_type `manual_receipt` or `manual_payment`, reference_number `PAY-BACKFILL-<journal_entry_id>`) and **updates** `journal_entries.payment_id` to the new payment id. Those entries then appear in Roznamcha.

**Note:** Phase 4 apply migrations were added to `migrations/` (phase4_legacy_worker_payment_cleanup_apply.sql, phase4_legacy_supplier_payment_cleanup_apply.sql, phase4_legacy_manual_payment_backfill_apply.sql). The migration runner did not reach them in the last run due to an earlier failure (commission_batches). Run these manually in Supabase SQL Editor or fix the failing migration and re-run `node scripts/run-migrations.js --allow-fail` so they execute.

---

## 3. What legacy objects are now frozen

- **document_sequences** — LEGACY_CANDIDATE; still written by credit notes, refunds, returns. Do not use for **new** payment numbering (use erp_document_sequences).
- **document_sequences_global** — LEGACY_CANDIDATE; prefer erp_document_sequences for payment refs.
- **chart_accounts** — LEGACY_CANDIDATE; live chart = `accounts`. Not used for posting.
- **account_transactions** — LEGACY_CANDIDATE; not part of live double-entry.
- **worker_payments** — LEGACY_CANDIDATE; worker ledger = worker_ledger_entries; verify no new posting.

Table comments were set in Phase 1 (accounting_stabilization_phase1_legacy_comments.sql). See `docs/ACCOUNTING_LEGACY_OBJECT_FREEZE.md` for full list and service guards.

---

## 4. Final Roznamcha policy

See **docs/ROZNAMCHA_POLICY_LOCK.md**.

**Summary:**

- **Include:** Cash/bank/wallet in and out; supplier payments; worker payments; expense payments; manual payment/receipt entries (one side payment account); sale/on-account receipts; rental; studio. Source = `payments` table only.
- **Exclude:** Pure journal adjustments; accrual-only entries; manual journal-only entries (both sides non–payment). No `payments` row ⇒ not in Roznamcha.
- **Mapping:** Roznamcha reads from `payments`. Journal entries linked via `journal_entries.payment_id`. Manual entry classification in app: if one side is payment account → create payments row + journal with payment_id; else journal only.

---

## 5. Report source verification

| Report | Source | Verified |
|--------|--------|----------|
| **Day Book** | `journal_entries` + `journal_entry_lines` (Supabase) | Yes – DayBookReport.tsx queries journal_entries with lines. |
| **Roznamcha** | `payments` only (getRoznamcha → fetchPaymentRows) | Yes – roznamchaService reads from payments table. |
| **Worker Ledger** | `worker_ledger_entries` (and ledger UI) | Yes – studioProductionService and worker payment flow write/read worker_ledger_entries. |
| **Supplier payment reporting** | `payments` (reference_type purchase/on_account) + purchaseService.getPaymentHistory | Yes – purchase payment history reads from payments table. |
| **Studio Costs** | `studioCostsService.getStudioCostsFromJournal` (journal_entries) | Yes – studio costs derived from journal, not legacy tables. |

No report was found reading from document_sequences, chart_accounts, or account_transactions for primary data. Legacy tables are not used as the source for Day Book, Roznamcha, Worker Ledger, or supplier payment history.

---

## 6. Files changed

| File | Change |
|------|--------|
| docs/ROZNAMCHA_POLICY_LOCK.md | **New.** Final Roznamcha include/exclude and mapping to payments/journal/manual entry. |
| docs/ACCOUNTING_LEGACY_OBJECT_FREEZE.md | **New.** Legacy table list, canonical objects, service guards. |
| docs/audit/legacy_supplier_payment_cleanup_preview.sql | **New.** Preview duplicate supplier JEs to mark. |
| docs/audit/legacy_supplier_payment_cleanup_apply.sql | **New.** Mark duplicate JEs (description suffix). |
| docs/audit/legacy_manual_payment_backfill_preview.sql | **New.** Preview manual JEs missing payments row. |
| docs/audit/legacy_manual_payment_backfill_apply.sql | **New.** Insert payments + link journal_entries.payment_id. |
| docs/audit/legacy_worker_payment_cleanup_preview.sql | **New.** Preview worker_ledger job rows with payment_reference. |
| docs/audit/legacy_worker_payment_cleanup_apply.sql | **New.** Set payment_reference = NULL on job rows. |
| docs/audit/legacy_object_freeze_audit.sql | **New.** List legacy/canonical tables and comments. |
| migrations/phase4_legacy_worker_payment_cleanup_apply.sql | **New.** Runnable migration for worker cleanup. |
| migrations/phase4_legacy_supplier_payment_cleanup_apply.sql | **New.** Runnable migration for supplier duplicate mark. |
| migrations/phase4_legacy_manual_payment_backfill_apply.sql | **New.** Runnable migration for manual payment backfill. |

---

## 7. SQL files created/run

| File | Purpose | Run |
|------|---------|-----|
| legacy_supplier_payment_cleanup_preview.sql | List duplicate supplier JEs to mark | Manual (read-only) |
| legacy_supplier_payment_cleanup_apply.sql | Mark duplicate JEs | Via phase4 migration or manual |
| legacy_manual_payment_backfill_preview.sql | List manual JEs to backfill with payments | Manual (read-only) |
| legacy_manual_payment_backfill_apply.sql | Insert payments + link journal | Via phase4 migration or manual |
| legacy_worker_payment_cleanup_preview.sql | List worker_ledger job rows to clear payment_reference | Manual (read-only) |
| legacy_worker_payment_cleanup_apply.sql | Clear payment_reference on job rows | Via phase4 migration or manual |
| legacy_object_freeze_audit.sql | List legacy/canonical objects and comments | Manual (read-only) |

**Run status:** Phase 4 apply migrations are in `migrations/` but were not executed in the last migration run because an earlier migration (commission_batches_rls_company_scoped.sql) failed. **Action:** Run the three phase4 apply scripts manually in Supabase SQL Editor for company `eb71d817-b87e-4195-964b-7b5321b480f5`, or fix the failing migration and re-run `node scripts/run-migrations.js --allow-fail`.

---

## 8. Archive/delete readiness (do not delete yet)

**1) Safe archive-first candidates (can be archived for history, then dropped later):**  
- `account_transactions` (if confirmed unused by any report or code)  
- `chart_accounts` (replaced by `accounts`)  
- Old duplicate journal entries that were only **marked** with `[LEGACY DUPLICATE]` (could be archived to a backup table if desired; not required for correctness)

**2) Tables/views/functions that must not be touched yet:**  
- `document_sequences`, `document_sequences_global` — still written by credit notes, refunds, returns.  
- `worker_payments` — verify usage before any change.  
- `payments`, `journal_entries`, `journal_entry_lines`, `accounts`, `worker_ledger_entries`, `erp_document_sequences` — canonical; do not drop.

**3) Exact prerequisites before deletion:**  
- All payment and document numbering must use `erp_document_sequences` + `documentNumberService` only.  
- Credit note, refund, and return flows must be migrated off `document_sequences`.  
- No code path may read from `chart_accounts` or `account_transactions` for live reporting.  
- Phase 4 apply scripts run and verified; one more clean audit pass.

**4) Recommended deletion order (for a future phase only):**  
1. Archive and drop `account_transactions` (if unused).  
2. Archive and drop `chart_accounts` (if unused).  
3. Migrate numbering; then archive and drop `document_sequences_global` (if unused).  
4. Migrate numbering; then archive and drop `document_sequences`.  
5. Do not drop `worker_ledger_entries`, `payments`, `journal_entries`, `journal_entry_lines`, `accounts`, `erp_document_sequences`.

---

## 9. What is still NOT safe to delete

- **Tables:** Do **not** drop or truncate: document_sequences, document_sequences_global, chart_accounts, account_transactions, worker_payments (if present). Still referenced or used by some code paths (e.g. document_sequences by credit notes/refunds/returns).
- **Rows:** Do not bulk-delete from journal_entries or payments; duplicate JEs were only **marked**, not removed.
- **Prerequisites before any future delete:** (1) Migrate all document number consumers to erp_document_sequences. (2) Confirm no code reads from chart_accounts/account_transactions for reporting. (3) One more clean audit pass after Phase 4 apply scripts have been run and verified.

---

## 10. Recommended next and final cleanup phase

1. **Run Phase 4 apply scripts** for the target company (manual or via migrations after fixing the failing migration). Re-run preview SQLs to confirm zero or expected counts after cleanup.
2. **Re-verify** legacy_object_freeze_audit.sql and that no new code writes to legacy tables for payment/supplier/worker posting.
3. **Next phase (optional):**  
   - Migrate credit notes, refunds, returns numbering from document_sequences to erp_document_sequences.  
   - Then mark document_sequences as read-only and add a guard in code to prevent new use.  
   - **Final phase:** After a full audit and backup, consider archive-then-drop for legacy tables in a fixed order: e.g. account_transactions (if unused), chart_accounts (if unused), then document_sequences/document_sequences_global after numbering migration. Do not drop worker_ledger_entries, payments, journal_entries, accounts, erp_document_sequences.

---

Document version: Phase 4. No table drops in this phase. Company: eb71d817-b87e-4195-964b-7b5321b480f5.
