# Journal engine — master plan (NEW POSV3)

Maps the **“journal-only / double-entry”** objective to **this repo’s real schema and code**, and lists phased work. This is the single reference when implementing migrations, RPCs, and refactors.

**AR/AP vs Contacts:** See **[AR_AP_CONTROL_VS_SUBLEDGER_AUDIT.md](./AR_AP_CONTROL_VS_SUBLEDGER_AUDIT.md)** for why invoice-based Contacts totals differ from Trial Balance, reconciliation views, and rollout order.

**AR/AP Reconciliation Center:** **[AR_AP_RECONCILIATION_CENTER.md](./AR_AP_RECONCILIATION_CENTER.md)** — operational vs GL vs exception queues (no force-match).

## 1. Canonical data model (actual names)

| Master prompt name | In this codebase |
|--------------------|------------------|
| `journal_lines` | **`journal_entry_lines`** |
| `journal_id` on line | **`journal_entry_id`** |
| `journal_entries.date` | **`journal_entries.entry_date`** (plus `created_at`) |
| `reference_type` / `reference_id` | Present on `journal_entries` (and related IDs such as `payment_id` where used) |

**Source of truth for GL totals (already documented in code):**

- `accounts` (COA)
- `journal_entries` + `journal_entry_lines`

`accountingReportsService.ts` **SOURCE LOCK (Phase 1)** already restricts TB / P&L / BS / account ledger to these tables—not subledgers for GL.

## 2. Double-entry enforcement

- **DB today:** `check_journal_entries_balance()` in `migrations/accounting_validate_journal_balance_trigger.sql` lists **unbalanced** journals (validation only; **no** row trigger—lines are often inserted one-by-one in the same logical batch).
- **Target:** Either (a) **transactional** posting that inserts all lines then asserts balance before commit, or (b) **deferred** constraint pattern, or (c) RPC `post_journal_entry` that writes header + N lines atomically and raises if `SUM(debit) ≠ SUM(credit)`.

**Do not** add a naive `BEFORE INSERT` per-line balance check without a deferred strategy—it will break legitimate multi-line inserts.

## 3. “No direct balance” — current exceptions (must be phased)

These **violate** strict journal-only truth until removed or demoted to **display cache only**:

| Location | Field / behavior | Direction |
|----------|------------------|-----------|
| `accounts` | `balance` | Synced from journal in places (e.g. repair/sync); **business rules must not** treat as authoritative for GL |
| `workers` | `current_balance` | Mutated from studio/production flows; **not** part of GL journal truth |
| Contacts / other modules | stored “balances” | Audit each; derive or subledger with clear boundary |

**Policy:** GL reports and ledger UI **must** use journal rollups. Stored balances may remain **optional cache** with a single writer (e.g. nightly sync) **only** if product agrees—not multiple writers.

## 4. Reports & ledger (SQL shape)

Use **`journal_entry_lines`** joined to **`journal_entries`**, exclude **`is_void = true`** where business reports apply.

- **Trial balance:** `SUM(debit)`, `SUM(credit)` by `account_id` over non-void lines; **global** `SUM(debit)` should equal `SUM(credit)` if every journal is balanced.
- **P&L / BS:** Filter by `accounts.type` and date range / as-of—same join pattern as `accountingReportsService`.

**Running balance** for account ledger: window over ordered lines (by `entry_date`, tie-break `created_at` / `entry_no` as implemented in app).

## 5. Module integration

All economic events that belong in the GL should funnel through **one path** (e.g. `accountingService` / document posting engine), producing balanced `journal_entries` + `journal_entry_lines`.

**Audit list (non-exhaustive):** sales, purchases, payments, expenses, inventory/cogs, studio worker pay—each must be checked for **bypass** inserts or **balance** updates.

## 6. Performance

Already present: `migrations/report_performance_indexes.sql` — `journal_entries(company_id, entry_date)`, `journal_entry_lines(journal_entry_id)`, `journal_entry_lines(account_id)`.

Optional later: materialized views for heavy dashboards (per company + period).

## 7. RLS & multi-tenant

All journal reads/writes must respect **`company_id`** (and branch where applicable). Views added for validation should be queried with the same roles/policies as underlying tables.

## 8. Deliverables checklist

| # | Deliverable | Status |
|---|-------------|--------|
| 1 | Migrations (constraints / RPC / views) | **Views + doc** in this phase; full RPC/trigger in a follow-up |
| 2 | RPC `create_journal_entry` / atomic post | Follow-up (align with `accountingService`) |
| 3 | Refactor services (no balance-as-truth) | Phased; see §3 |
| 4 | Validation script | **`scripts/verify-journal-source-of-truth.mjs`** + views in `20260326_journal_sot_validation_views.sql` |
| 5 | Reports | Already journal-based in `accountingReportsService`; keep aligned |
| 6 | Ledger UI | Ensure primary query is journal lines + running balance |

## 9. Quick validation (after migration apply)

```bash
node scripts/verify-journal-source-of-truth.mjs
```

Expected when healthy:

```text
ALL SYSTEM CONSISTENT ✅
```

If not, the script prints counts and sample rows from `v_accounting_*` views.
