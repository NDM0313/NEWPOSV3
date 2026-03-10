# Studio Accounting Dashboard — Technical Reference

## Overview

The Studio Costs dashboard (`Accounting → Studio Costs` tab) is now fully
accounting-driven. All summary card values are calculated directly from
**journal entry lines** stored in the `journal_entry_lines` table, instead
of the legacy `worker_ledger_entries` / `studio_production_stages` tables.

---

## ERP Accounting Flow

```
Studio Stage Completed
        │
        ▼
Journal Entry Created
  Dr  Cost of Production  (account 5000)   ← stage cost
  Cr  Worker Payable       (account 2010)

Worker Payment Made
        │
        ▼
Journal Entry Created
  Dr  Worker Payable  (account 2010)       ← reduces payable
  Cr  Cash / Bank     (account 1000/1010)
```

---

## Dashboard Card Calculations

| Card | Formula | Account |
|------|---------|---------|
| **Total Cost** | `SUM(debit) − SUM(credit)` | Code `5000` (Cost of Production) |
| **Outstanding** | `SUM(credit) − SUM(debit)` | Code `2010` (Worker Payable) |
| **Paid** | `Total Cost − Outstanding` | Derived |
| **Workers** | `COUNT(DISTINCT worker_id)` | From stage references |
| **Productions** | `COUNT(studio_productions)` | Production table |

---

## Data Source Priority

```
1. PRIMARY   → journal_entry_lines (accounting-driven)
               Badge: "Live from Journal Entries" (green)

2. FALLBACK  → worker_ledger_entries (legacy)
               Badge: "From Legacy Ledger" (amber)
```

The primary path is used when `journal_entry_lines` records exist for
accounts `5000` or `2010` for the company.  The fallback is used for
installations that pre-date the journal entry integration.

---

## Worker Breakdown (By Worker view)

Steps performed by `studioCostsService.getStudioCostsFromJournal()`:

1. Query `journal_entries` filtered by `company_id` and
   `reference_type IN ('studio_production_stage', 'studio_production_stage_reversal', 'payment')`.
2. Get `journal_entry_lines` for those entries where `account_id` matches
   account code `5000` or `2010`.
3. Join `studio_production_stages` via `journal_entries.reference_id` to
   resolve `assigned_worker_id` and `stage_type`.
4. Resolve worker names from `workers` table, falling back to `contacts`.
5. Cross-reference `worker_ledger_entries` for per-stage paid/unpaid status
   (if available).
6. Return aggregated `WorkerCostSummary[]` sorted by outstanding balance.

---

## Production Breakdown (By Production view)

Always reads from `studio_productions` + `studio_production_stages` tables.
These reflect real-time stage status including in-progress stages.
Paid/unpaid status per stage comes from `worker_ledger_entries` when available.

---

## Required Chart of Accounts

Run `migrations/accounting_ensure_default_accounts.sql` once in Supabase
SQL Editor to ensure these accounts exist for all companies:

| Code | Name | Type |
|------|------|------|
| `2000` | Accounts Receivable | Asset |
| `4000` | Sales Revenue | Revenue |
| `5000` | Cost of Production | Expense |
| `2010` | Worker Payable | Liability |

---

## Performance Indexes

Run `migrations/journal_entry_lines_performance_indexes.sql` for optimal
query speed:

```sql
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_account_id
  ON journal_entry_lines(account_id);

CREATE INDEX IF NOT EXISTS idx_journal_entries_company_reftype
  ON journal_entries(company_id, reference_type);

-- + 5 additional targeted indexes
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/app/services/studioCostsService.ts` | Full rewrite — journal-first with legacy fallback |
| `src/app/components/accounting/StudioCostsTab.tsx` | Data source badge in footer |
| `src/app/services/saleAccountingService.ts` | New — Dr AR / Cr Revenue on sale finalization |
| `src/app/services/saleService.ts` | Accounting hooks in `updateSaleStatus` + `updateSale` |
| `src/app/components/accounting/AccountingDashboard.tsx` | Fixed income filter to include `Sales Revenue` |
| `migrations/accounting_ensure_default_accounts.sql` | New — ensure accounts 2000/4000/5000/2010 |
| `migrations/journal_entry_lines_performance_indexes.sql` | New — DB indexes |

---

## Sale Accounting Flow (ERP Rule)

```
Draft Sale     → No journal entry
Final Sale     → Dr Accounts Receivable (2000) / Cr Sales Revenue (4000)
Cancelled Sale → Dr Sales Revenue (4000) / Cr Accounts Receivable (2000)  [reversal]
```

Duplicate protection: `saleAccountingService` checks for an existing journal
entry with `reference_type='sale'` + `reference_id=saleId` before creating,
ensuring exactly one entry per sale.
