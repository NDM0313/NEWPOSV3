# Accounting Stabilization Phase 1 – Deliverables

**Company:** `company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'`  
**Constraints:** No table deletes, no destructive cleanup, no renaming of accounting tables.

---

## 1. Payment numbering findings

| Path | Source | Classification |
|------|--------|----------------|
| **saleService.recordPayment** | `documentNumberService.getNextDocumentNumber(companyId, branchId, 'payment')` → `generate_document_number` RPC → **erp_document_sequences** | **Canonical** |
| **saleService.recordOnAccountPayment** | Same as above | **Canonical** |
| **purchaseService.recordPayment** | Same as above | **Canonical** |
| **purchaseService.recordOnAccountPayment** | Same as above | **Canonical** |
| **UnifiedPaymentDialog (worker)** | Was: `useDocumentNumbering().generateDocumentNumber('payment')` (client-side) + `incrementNextNumber('payment')` | **Legacy – fixed** → now uses `documentNumberService.getNextDocumentNumber(..., 'payment')` |
| **record_customer_payment RPC** | `get_next_document_number(p_company_id, v_branch_id, 'payment')` (wrapper to `generate_document_number` per `unify_document_numbering_single_engine.sql`) | **Canonical** (if migration applied) |
| **Fallback** | `paymentUtils.generatePaymentReference()` (timestamp + random) | **Fallback only** when RPC fails; documented |

**Legacy / must migrate (not for PAY):**  
- **document_sequences** – used by refundService, creditNoteService, purchaseReturnService (for their doc types, not PAY).  
- **document_sequences_global** – used for CUS, SL; not used for PAY in app after fixes.

**Conclusion:** For PAYMENT documents, the only active path is **generate_document_number** backed by **erp_document_sequences**. All payment inserts now use that path or the RPC wrapper; worker payment no longer uses client-side counter.

---

## 2. Payment numbering fix applied

- **UnifiedPaymentDialog (worker case):** Replaced `generateDocumentNumber('payment')` and `incrementNextNumber('payment')` with `documentNumberService.getNextDocumentNumber(companyId, branchId, 'payment')`. Fallback to timestamp+random only on RPC error.
- **paymentUtils.generatePaymentReference:** Documented as fallback only; prefer `documentNumberService.getNextDocumentNumber(..., 'payment')`.
- **saleService.recordPayment:** Added guardrail comment: on duplicate `reference_number` (unique constraint), do not retry with same ref; obtain new ref via getNextDocumentNumber again.
- No change to **record_customer_payment** RPC (already uses `get_next_document_number`, which is a wrapper to `generate_document_number` when `unify_document_numbering_single_engine.sql` is applied).

---

## 3. Expense imbalance root cause

- **Frontend:** `ExpenseContext` → `accounting.recordExpense` → `AccountingContext.createEntry` with `debitAccount: 'Expense'`, `creditAccount: paymentMethod` (Cash/Bank). This always produces **two lines** (Dr Expense, Cr Cash/Bank). `accountingService.createEntry` validates `totalDebit === totalCredit` and throws if not.
- **RPC / DB:** Possible sources of single-line or imbalanced expense entries:
  - **create_extra_expense_journal_entry** (sale extra expense): Some versions insert only one line (Dr Expense) or two debits (Dr Expense, Dr AR). Both are imbalanced.
  - **create_expense_with_accounting** (supabase-extract 09_expense_transaction.sql): Inserts two lines correctly; if not used in production, not the cause.
- **Conclusion:** The 7 imbalanced expense entries are likely from an older or incorrect **create_extra_expense_journal_entry** (or similar) that wrote only a debit line or two debits. Frontend expense posting is already balanced; validation in `createEntry` blocks new unbalanced entries and logs when expense entries fail balance check.

---

## 4. Expense posting fix applied

- **accountingService.createEntry:** Existing double-entry check retained. Added logging when an **expense** or **extra_expense** entry fails balance validation (console.error with reference_type, totals, line count).
- **No change to RPC** in this phase (no destructive cleanup). Future phase can replace `create_extra_expense_journal_entry` with a balanced version (e.g. Dr Expense, Cr AR for “extra charge to customer” or Dr Expense, Cr Cash).
- All **future** expense posts from the app go through `createEntry`, which blocks unbalanced inserts.

---

## 5. Existing bad expense entries repair plan

- **Diagnostic:** `migrations/accounting_stabilization_phase1_diagnostic.sql` – lists imbalanced journal entries (debit ≠ credit) for expense/extra_expense/description ILIKE '%expense%' for the company.
- **Preview:** `migrations/accounting_stabilization_phase1_repair_preview.sql` – read-only; shows the balancing line that would be added per imbalanced entry (credit side to Cash 1000 when debit > credit).
- **Approved repair:** `migrations/accounting_stabilization_phase1_repair_approved.sql` – **INSERT only**; adds one balancing line per imbalanced expense entry (credit line when debit > credit, debit line when credit > debit), using company Cash account (1000 or name LIKE '%cash%'). No deletes.
- **Order:** Run diagnostic → run preview → verify → run approved repair. Re-run diagnostic to confirm zero imbalanced expense entries.

---

## 6. Report source lock document created

- **docs/ACCOUNTING_SOURCE_LOCK.md** – Defines for each report:
  - **Journal** = `journal_entries` + `journal_entry_lines` (+ `accounts` supporting).
  - **Day Book** = same as Journal.
  - **Roznamcha** = `payments` only; explains why journal-only entries are excluded.
  - **Worker Ledger** = `worker_ledger_entries`.
  - **Studio Costs** = journal (studio + worker_payment) + worker_ledger_entries + studio_production_stages.
  - **Courier Payables** = journal + journal_entry_lines + accounts (2030/203x).
  - **Receivables** = sales + payments (sale/on_account) + customer ledger RPCs.
  - **Payables** = purchases + payments (purchase), worker_ledger_entries, accounts (203x).
- Each section states canonical, supporting, and “do not use.”

---

## 7. Legacy objects marked

- **docs/ACCOUNTING_LEGACY_MAP.md** – Lists **document_sequences**, **document_sequences_global**, **chart_accounts**, **account_transactions**, **worker_payments** as LEGACY_CANDIDATE / DO NOT USE FOR NEW POSTING.
- **migrations/accounting_stabilization_phase1_legacy_comments.sql** – Adds `COMMENT ON TABLE` for these tables (when they exist), marking them as legacy. No drops.

---

## 8. Files changed

| File | Change |
|------|--------|
| `src/app/components/shared/UnifiedPaymentDialog.tsx` | Worker payment ref: use `documentNumberService.getNextDocumentNumber(..., 'payment')`; remove `generateDocumentNumber`/`incrementNextNumber` for payment. |
| `src/app/utils/paymentUtils.ts` | Comment: fallback only; prefer ERP numbering. |
| `src/app/services/saleService.ts` | Guardrail comment: on duplicate ref do not retry with same ref. |
| `src/app/services/accountingService.ts` | Log unbalanced expense entry attempt before throwing in createEntry. |

---

## 9. SQL files created

| File | Purpose |
|------|--------|
| `migrations/accounting_stabilization_phase1_diagnostic.sql` | Duplicate payment refs, max PAY vs sequence, imbalanced expense entries (read-only). |
| `migrations/accounting_stabilization_phase1_repair_preview.sql` | Preview balancing lines for imbalanced expense entries (read-only). |
| `migrations/accounting_stabilization_phase1_repair_approved.sql` | INSERT balancing lines for imbalanced expense entries (run after preview). |
| `migrations/accounting_stabilization_phase1_legacy_comments.sql` | COMMENT ON TABLE for legacy candidates. |

**Existing audit SQL (unchanged):** `docs/audit/payment_reference_sequence_audit.sql` – duplicate refs, PAY distribution, sequence comparison, worker_ledger payment_reference.

---

## 10. Verification checklist

- [ ] Run `migrations/accounting_stabilization_phase1_diagnostic.sql` for company; note duplicate payment refs (aim 0) and imbalanced expense count (aim 0 after repair).
- [ ] Run `docs/audit/payment_reference_sequence_audit.sql`; confirm max PAY vs erp_sequence_last is consistent; no duplicate reference_number in payments.
- [ ] Worker payment from UnifiedPaymentDialog: record one worker payment; confirm reference_number is PAY-xxxx from ERP (check payments.reference_number and erp_document_sequences).
- [ ] Run `migrations/accounting_stabilization_phase1_repair_preview.sql`; if rows returned, run `migrations/accounting_stabilization_phase1_repair_approved.sql`; re-run diagnostic and confirm no imbalanced expense entries.
- [ ] Run `migrations/accounting_stabilization_phase1_legacy_comments.sql`; verify table comments in DB.
- [ ] Confirm no new payment flow uses `document_sequences` or `document_sequences_global` for PAY.
- [ ] Confirm report implementations align with **docs/ACCOUNTING_SOURCE_LOCK.md** (no new reads from legacy tables for canonical reports).
