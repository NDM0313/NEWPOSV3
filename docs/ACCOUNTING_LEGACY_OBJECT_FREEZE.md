# Accounting Legacy Object Freeze (Phase 4)

The following tables/objects are **legacy** for accounting posting. New posting paths must **not** write to them. They are marked LEGACY_CANDIDATE and kept for backward compatibility until a future cleanup phase.

---

## 1. Legacy tables (DO NOT USE FOR NEW POSTING)

| Object | Status | Still written by code? | Notes |
|--------|--------|-------------------------|--------|
| **document_sequences** | LEGACY_CANDIDATE | Yes (credit notes, refunds, returns, purchase return) | Prefer `erp_document_sequences` + `documentNumberService.getNextDocumentNumber` for PAY, SL, PUR. Payment numbering is canonical via erp_document_sequences. |
| **document_sequences_global** | LEGACY_CANDIDATE | Yes (some paths) | Prefer erp_document_sequences for payment refs. |
| **chart_accounts** | LEGACY_CANDIDATE | No | Live chart = `accounts`. Posting uses `accounts` + journal_entries + journal_entry_lines. |
| **account_transactions** | LEGACY_CANDIDATE | No | Not part of live double-entry. Do not use for new posting. |
| **worker_payments** | LEGACY_CANDIDATE | Verify | Worker ledger = `worker_ledger_entries`. Canonical worker payment = payments + journal + worker_ledger_entries. |

---

## 2. Canonical posting objects (USE THESE)

| Object | Use for |
|--------|---------|
| **accounts** | Chart of accounts, account lookup |
| **journal_entries** | All double-entry journal headers |
| **journal_entry_lines** | All double-entry lines |
| **payments** | All money movement (Roznamcha source); link via journal_entries.payment_id |
| **worker_ledger_entries** | Worker ledger (job/stage + accounting_payment rows) |
| **erp_document_sequences** | Payment and other document number generation (canonical) |

---

## 3. Service guards

- **Payment numbering:** Use `documentNumberService.getNextDocumentNumber(companyId, branchId, 'payment')` only. Do not use document_sequences for new payment refs.
- **Supplier payment:** Use `supplierPaymentService.createSupplierPayment()` only (writes payments + one journal entry).
- **Worker payment:** Use `workerPaymentService.createWorkerPayment()` when paying workers (writes payments + journal + worker_ledger_entries).
- **Manual entry with payment account:** Handled in AccountingContext.createEntry (creates payments row + journal when one side is payment account).

---

## 4. Comments on tables

Phase 1 migrations already set:

- `COMMENT ON TABLE document_sequences IS 'LEGACY_CANDIDATE: ...'`
- `COMMENT ON TABLE chart_accounts IS 'LEGACY_CANDIDATE: ...'`
- `COMMENT ON TABLE account_transactions IS 'LEGACY_CANDIDATE: ...'`
- `COMMENT ON TABLE worker_payments IS 'LEGACY_CANDIDATE: ...'`

Run `docs/audit/legacy_object_freeze_audit.sql` to list current table comments and posting status.

---

## 5. What not to do

- Do **not** add new code paths that INSERT/UPDATE document_sequences for payment numbering.
- Do **not** post to chart_accounts or account_transactions.
- Do **not** create duplicate supplier payment journal entries (use canonical supplier payment service only).
- Do **not** set payment_reference on worker_ledger_entries where reference_type = 'studio_production_stage' (job rows).

Document version: Phase 4. No table drops in this phase.
