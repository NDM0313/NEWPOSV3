# Accounting Source Lock (Phase 1)

**Status:** Enforced from Phase 1. Do not mix legacy or overlapping tables into live GL calculations.

Reference: `docs/accounting/RESET COMPANY/ACCOUNTING_PHASE_PLAN_AND_PROMPTS.md` — Phase 1.

---

## 1. Canonical source-of-truth

| Purpose | Canonical table(s) | Do NOT use for live calculations |
|--------|---------------------|-----------------------------------|
| **Chart of Accounts** | `accounts` | Any other account list or legacy COA table |
| **Journal / Day Book** | `journal_entries`, `journal_entry_lines` | `ledger_entries` or any non-journal source for GL totals |
| **Roznamcha (cash/bank movement)** | `payments` | Document-level payment fields only for display; movement = payments |
| **Worker ledger** | `worker_ledger_entries` | Workers.current_balance or other derived balance for truth |
| **Payment numbering** | `erp_document_sequences` | Hardcoded or alternate sequence sources |
| **Supplier/User ledger (UI)** | `ledger_master`, `ledger_entries` | **UI layer only** — not GL truth; Trial Balance / P&L / Balance Sheet must not use these for amounts |

---

## 2. Rules

1. **COA** — All account list and account lookup for posting/reports: `accounts` only.
2. **Journal** — All GL totals, Trial Balance, P&L, Balance Sheet, Day Book: `journal_entries` + `journal_entry_lines` only. No `ledger_entries` in these calculations.
3. **Roznamcha** — Cash/bank movement and payment rows: `payments` only.
4. **Worker ledger** — Worker payable balance and worker payment history: `worker_ledger_entries` (and journal for audit).
5. **Supplier/Customer ledger UI** — `ledger_master` + `ledger_entries` are for **display only** (Supplier Ledger screen, User Ledger screen). They are synced from documents/payments for UI convenience. They must not be used as source for Trial Balance, P&L, Balance Sheet, or any GL report.

---

## 3. Verification (Phase 1)

- [x] Trial Balance: `accountingReportsService.getTrialBalance` uses `accounts` + `journal_entry_lines` + `journal_entries` only.
- [x] P&L / Balance Sheet: same service uses same sources.
- [x] Day Book / Journal list: `accountingService` uses `journal_entries` + `journal_entry_lines` only (no ledger_entries).
- [x] Roznamcha: `roznamchaService` uses `payments`; manual payments use `payments` + journal.
- [x] Worker ledger: studio and worker payment use `worker_ledger_entries`; posting goes through journal + payments.
- [x] No report reads `ledger_entries` or `ledger_master` for GL totals.

---

## 4. Files that enforce source lock

| File | Role |
|------|------|
| `src/app/services/accountingReportsService.ts` | Trial Balance, P&L, Balance Sheet, Account Ledger — accounts + journal only |
| `src/app/services/accountingService.ts` | Day Book, journal list — journal_entries + journal_entry_lines only |
| `src/app/services/roznamchaService.ts` | Roznamcha — payments + accounts for names |
| `src/app/services/ledgerService.ts` | Supplier/User ledger UI — ledger_master + ledger_entries (UI only) |
| `src/app/services/ledgerDataAdapters.ts` | Adapts ledger_entries / worker_ledger_entries for UI (not GL) |
| `src/app/services/addEntryV2Service.ts` | Add entry: payments, journal, ledger sync for UI where applicable |

---

*Last updated: Phase 1 completion.*
