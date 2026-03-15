# Accounting Legacy Objects Map

**Phase 1: Stabilization.** No tables dropped. These objects are marked as **LEGACY_CANDIDATE** / **DO NOT USE FOR NEW POSTING**. Use for migration planning only.

| Object | Status | Guidance |
|--------|--------|----------|
| **document_sequences** | LEGACY_CANDIDATE | Prefer `erp_document_sequences` + `generate_document_number` for PAY, SL, PUR, etc. Still used by refundService, creditNoteService, purchaseReturnService; migrate when feasible. |
| **document_sequences_global** | LEGACY_CANDIDATE | Alternate numbering (CUS, SL). Prefer `erp_document_sequences` + `generate_document_number` for PAY, SL where possible. |
| **chart_accounts** | LEGACY_CANDIDATE | Live Chart of Accounts is `accounts`. Do not use for posting. (supabase-extract schema.) |
| **account_transactions** | LEGACY_CANDIDATE | Legacy; not part of live double-entry. Do not use for new posting. |
| **worker_payments** | LEGACY_CANDIDATE | Verify if any code still inserts/reads. If unused, do not use for new posting. Worker ledger = `worker_ledger_entries`. |

**Canonical for numbering:** `erp_document_sequences` + RPC `generate_document_number`.  
**Canonical for CoA and journal:** `accounts`, `journal_entries`, `journal_entry_lines`, `payments`, `worker_ledger_entries`.
