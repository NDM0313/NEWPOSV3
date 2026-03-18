# Phase 1 — Source Lock Enforcement: RESULT

**Date:** 2025-03-18  
**Plan reference:** `ACCOUNTING_PHASE_PLAN_AND_PROMPTS.md` — Phase 1  
**Status:** Complete (awaiting approval before Phase 2)

---

## 1. Root cause

Accounting was at risk of **mixed sources**: multiple layers could read from different tables for the same concept (e.g. COA vs legacy list, journal vs ledger_entries for GL). Phase 1 does not fix a single bug; it **locks** which tables are the only sources for live calculations so that:

- All GL reports use one journal truth (`journal_entries` + `journal_entry_lines`).
- COA is only `accounts`.
- Roznamcha is only `payments`.
- Worker ledger truth is `worker_ledger_entries`.
- Payment numbering uses `erp_document_sequences`.
- `ledger_master` / `ledger_entries` are **classified as UI ledger only** (supplier/user screens), not used for Trial Balance, P&L, or Balance Sheet.

---

## 2. Files changed

| File | Change |
|------|--------|
| `docs/accounting/ACCOUNTING_SOURCE_LOCK.md` | **New.** Source-lock matrix and verification checklist. |
| `src/app/services/accountingReportsService.ts` | Header comment: GL reports use only accounts + journal (no ledger_entries). |
| `src/app/services/accountingService.ts` | Comment: SOURCE LOCK — journal_entries + journal_entry_lines only. |
| `src/app/services/ledgerService.ts` | Header: ledger_master/ledger_entries = UI layer only, not GL truth. |
| `src/app/services/ledgerDataAdapters.ts` | Header: ledger_master/ledger_entries = UI display only. |
| `src/app/services/addEntryV2Service.ts` | Header: source lock + ledger_entries only for UI sync. |
| `src/app/services/roznamchaService.ts` | Header: SOURCE LOCK — movement from payments, names from accounts. |
| `src/app/services/documentNumberService.ts` | Header: payment numbering = erp_document_sequences. |

---

## 3. SQL / migrations used

**None.** Phase 1 is documentation and code comments only. No schema changes, no data migration, no live data touched.

---

## 4. Verification done

- **Trial Balance / P&L / Balance Sheet:** `accountingReportsService` uses only `accounts`, `journal_entry_lines`, `journal_entries`. No reference to `ledger_entries` or `ledger_master` in that file.
- **Day Book / Journal list:** `accountingService.getAllEntries` uses `journal_entries` + `journal_entry_lines` (and `accounts` for names). Comment confirms no ledger_entries for GL.
- **Roznamcha:** `roznamchaService` reads from `payments`; account names from `accounts`.
- **Worker ledger:** Studio and worker payment flows use `worker_ledger_entries`; posting goes through journal + payments.
- **Payment numbering:** Add Entry V2 and payment flows use `documentNumberService` → `generate_document_number` RPC → `erp_document_sequences`.
- **Supplier/User ledger:** `ledgerService` and `ledgerDataAdapters` use `ledger_master` + `ledger_entries` only for **UI** (screens); no report uses them for GL totals.

---

## 5. Summary

- **Goal:** Ensure all code uses the same accounting sources; no report mixes legacy/overlapping tables into live calculations.
- **Deliverables:** `ACCOUNTING_SOURCE_LOCK.md` plus explicit SOURCE LOCK comments in 7 service files.
- **Acceptance:** No report or module can use old/legacy accounting tables for live GL calculations; ledger_master/ledger_entries are UI-only.
- **Next:** Stop. Wait for approval. Then Phase 2 (COA cleanup and mapping lock).

---

## 6. Git commit hash

`47d12b2` — Phase 1: Accounting source lock enforcement (docs + comments)
