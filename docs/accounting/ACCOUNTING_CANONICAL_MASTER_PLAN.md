# Accounting Canonical Recovery Master Plan

## Purpose

This file is the single roadmap for accounting cleanup, validation, canonical cutover, and final legacy deletion.

The goal is to move the ERP to a strict canonical accounting system where:

- GL truth = `journal_entries` + `journal_entry_lines`
- Operational truth = document/workflow tables (`sales`, `purchases`, `rentals`, `expenses`, `worker_ledger_entries`, `studio_*`)
- Stored balances = cache only, never GL truth
- Legacy / duplicate tables = retired only after dependency proof and signoff

---

## Core rules

### Rule 1 — Never mix GL and operational silently
Every surface must be clearly labeled as one of:

- Operational
- GL (journal)
- Reconciliation
- Pending mapping
- Cached (non-GL)

### Rule 2 — GL amounts must come only from journals
For all accounting / trial balance / account ledger / control-account totals:

- use `journal_entries`
- use `journal_entry_lines`
- use `accounts` as chart structure only

Do not use:

- `accounts.balance`
- `contacts.current_balance`
- `workers.current_balance`
- `ledger_entries`
- `ledger_master`
- `chart_accounts`
- `account_transactions`

as GL truth.

### Rule 3 — Do not delete legacy tables until all conditions pass
Delete is the final phase, not the next phase.

### Rule 4 — No silent fallback after partial or stale load
If operational data is loading or stale:

- show skeleton
- show `—`
- show warning
- but do not show misleading final numbers

---

# Phase 0 — Safety and backup

## Objective
Make sure every major repair step is reversible.

## Required
- database backup before destructive or bulk repair work
- audit tables for SQL repair waves
- rollback SQL for any batch update
- environment confirmation before running on production

## Exit criteria
- backup exists
- rollback path documented
- audit tables available

---

# Phase 1 — Canonical source policy

## Objective
Define which tables and services are allowed to provide accounting truth.

## Canonical classification

### A — Canonical GL
- `journal_entries`
- `journal_entry_lines`

### B — Canonical operational
- `sales`
- `sale_items` / `sales_items`
- `purchases`
- `purchase_items`
- `rentals`
- `expenses`
- `payments`
- `contacts`
- `workers`
- `worker_ledger_entries`
- `studio_productions`
- `studio_production_stages`

### C — Cache / derived / diagnostic only
- `accounts.balance`
- `contacts.current_balance`
- `workers.current_balance`
- any UI-only precomputed balance
- diagnostics comparing stored vs journal

### D — Legacy / duplicate / archive candidate
- `ledger_master`
- `ledger_entries`
- `chart_accounts`
- `account_transactions`
- `backup_*`
- `backup_cr_*`
- `backup_pf145_*`

## Exit criteria
- source registry complete
- table classification complete
- balance source policy complete

---

# Phase 2 — Party statement split

## Objective
Split customer / supplier / worker views into three explicit engines.

## Required UI structure
For each party statement:

1. Operational
2. GL (journal)
3. Reconciliation

## Rules
- no unlabeled “ledger”
- no mixed running balance
- no operational rows merged into GL running balance

## Exit criteria
- customer statement split complete
- supplier statement split complete
- worker statement split complete
- classic mixed screens retired or marked legacy

---

# Phase 3 — Payment ↔ journal contract hardening

## Objective
Make sure every payment-related flow creates correct linked journal entries.

## Required contract
For payment-like transactions:

- `payments.id` exists
- `payments.contact_id` exists where party-based
- `journal_entries.payment_id = payments.id`
- `journal_entries.reference_id` correctly set
- `reference_type` is canonical and stable
- display ref can resolve

## Covered flows
- sale payment
- customer on-account payment
- supplier payment
- worker payment
- manual payment / adjustment flows

## Exit criteria
- no new `PAYMENT_WITHOUT_JE` for covered flows
- no new weak payment JEs
- display references resolve correctly

---

# Phase 4 — Historical payment JE repair

## Objective
Repair old broken payment-linked journals without deleting history.

## Scope
Only:
- update `journal_entries`
- insert audit rows into repair audit table

## Included repair waves
- P3: `payment_id` set, `reference_id` null → set `reference_id = payment_id`
- P4: `reference_id` valid, `payment_id` null → set `payment_id = reference_id`
- P5: sale/purchase payment JEs with `payment_id` but null `reference_id` → set from `payments.reference_id`
- P6: both null → heuristic unique match only

## Required files
- `migrations/20260340_historical_payment_je_linkage_repair.sql`
- `migrations/20260341_phase4_payment_je_linkage_repair_apply.sql`
- `scripts/sql/phase3_payment_je_linkage_playbook.sql`
- `docs/accounting/PHASE4_REPAIR_EXECUTION_RESULT.md`
- `docs/accounting/PHASE4_REPAIR_COUNTS_TEMPLATE.json`

## Exit criteria
- before/after counts captured
- repaired rows audited
- rollback path tested in non-prod
- no Phase 4 repair candidate left in its defined buckets

---

# Phase 5 — Remove duplicate ledger engine

## Objective
Remove `ledger_master` / `ledger_entries` from live accounting logic.

## Required replacements
Replace any old usage with:

- operational documents (`sales`, `purchases`, `rentals`, `expenses`, `worker_ledger_entries`)
- payments
- journal-based GL where needed

## Rules
- `ledger_entries` can no longer drive balances
- `ledger_master` cannot be used as a truth source
- any remaining legacy screen must be explicitly labeled non-GL

## Exit criteria
- no live `.from('ledger_entries')`
- no live `.from('ledger_master')`
- duplicate ledger engine no longer drives business logic

---

# Phase 6 — Remove stored balance dependency

## Objective
Stop using stored balances as GL truth in UI and services.

## Remove as GL truth
- `accounts.balance`
- `contacts.current_balance`
- `workers.current_balance`

## Allowed
These may remain as:
- cache
- fallback only if clearly labeled
- diagnostics only

## Exit criteria
- GL-facing screens use journal balances or explicit cached label
- no GL screen silently trusts stored balance
- dashboard cash/bank parity verified

---

# Phase 7 — Worker accounting closure

## Objective
Make worker operational and GL flows consistent and explainable.

## Worker accounting rules

### Before bill
Worker payment:
- Dr 1180 Worker Advance
- Cr Cash/Bank

### Bill generated
- Dr Cost / Production
- Cr 2010 Worker Payable

### Advance settlement after bill
- Dr 2010
- Cr 1180

### Post-bill payment
- Dr 2010
- Cr Cash/Bank

## Required verification
One real worker scenario:

1. assign worker
2. complete stage / generate bill
3. make partial payment
4. leave remaining balance

Then verify:
- operational pending
- GL 2010
- GL 1180
- settlement JE
- reconciliation
- tie-out
- integrity lab

## Exit criteria
- worker operational vs GL clearly explained
- routing logic stable
- real worker scenario passes

---

# Phase 8 — Contacts list and UI sync

## Objective
Ensure the UI reflects the corrected accounting truth.

## Problems to prevent
- stale async overwrite
- wrong fallback merge
- partial opening-only values shown as final
- missing refresh dispatch after payment
- old values surviving after RPC returns

## Required behavior
- Contacts list row = Operational only
- optional mismatch badge vs party GL slice
- successful RPC must overwrite visible row values
- stale/timeout state must not freeze wrong numbers
- payment flows must dispatch refresh events

## Exit criteria
- Contacts list matches Operational statement
- no stale values after payment
- refresh works after customer / supplier / worker / rental payments

---

# Phase 9 — Control account breakdown finalization

## Objective
Make AR/AP/worker control accounts readable and auditable.

## Important rule
Do not create separate GL accounts for every customer/supplier by default.

Use:
- control account + subledger / drilldown / breakdown UI

## Required control accounts
- `1100 Accounts Receivable`
- `2000 Accounts Payable`
- `2010 Worker Payable`
- `1180 Worker Advance`
- `1195 AR/AP Reconciliation Suspense`

## Required breakdowns

### 1100 AR
- customer receivables
- studio receivables
- rental receivables
- opening receivables
- manual / unmatched receivables
- party-wise GL slice

### 2000 AP
- supplier payables
- other / non-supplier purchase bucket
- manual / unmatched payables
- party-wise GL slice

### 2010 / 1180
- worker bills
- worker advances
- settlements
- residual / pending mapping
- party-wise GL slice

## Exit criteria
- each bucket labeled by engine
- no fake subcategory totals
- control drawer clearly explains residual / pending mapping

---

# Phase 10 — Real party signoff

## Objective
Run manual, real-environment signoff on representative parties.

## Required parties
1. Walk-in Customer
2. one normal Customer
3. one Supplier
4. one Worker

## Required surfaces per party
- Contacts list
- Operational statement
- GL statement
- Reconciliation
- Party tie-out
- Integrity Lab
- Control account breakdown

## Required outcome
For each party:
- PASS / FAIL
- exact mismatch cause if FAIL
- screenshot or note for first failing surface

## Exit criteria
- all four party types signed off
- no unlabeled mismatch remains
- any remaining issue is isolated to one concrete failing screen or flow

---

# Phase 11 — Dashboard parity

## Objective
Ensure dashboard metrics use journal-based cash/bank, not stored balance.

## Required migration
- `migrations/20260342_dashboard_metrics_cash_bank_journal_sot.sql`

## Required verification
- RPC cash/bank
- company-wide journal aggregate
- dashboard displayed values

## Caveat
If UI trial balance is branch-scoped but RPC is company-wide, this must be explicitly documented.

## Exit criteria
- dashboard cash/bank matches journal company-wide logic
- no old stored-balance dashboard drift

---

# Phase 12 — Legacy retirement proof

## Objective
Prove which legacy tables are safe to archive or delete.

## Required proof for each candidate
- no live read path
- no write path
- no FK dependency needed by live app
- no BI/reporting dependency
- backup retained
- rollback / recovery documented

## Typical candidates
- `backup_*`
- `backup_cr_*`
- `backup_pf145_*`
- `chart_accounts`
- `account_transactions`
- eventually `ledger_master`
- eventually `ledger_entries`

## Output per table
- SAFE_TO_ARCHIVE
- SAFE_TO_DROP
- BLOCKED
- BLOCKED_WITH_REASON

## Exit criteria
- every delete candidate classified
- dependency proof complete

---

# Phase 13 — Delete / archive execution (FINAL PHASE)

## Objective
Only now perform controlled archive or deletion.

## Rules
- no blind delete
- no delete before signoff
- no delete without dependency proof
- no delete without backup

## Order
1. archive snapshots / export if needed
2. remove code usage
3. remove DB read/write dependency
4. confirm zero live dependency
5. drop blocked-off legacy tables only

## Examples of final delete candidates
Only if proven safe:
- `backup_pf145_*`
- `backup_cr_*`
- `chart_accounts`
- `account_transactions`
- `ledger_master`
- `ledger_entries`

## Exit criteria
- legacy tables dropped only after proof
- app still passes production checks
- accounting signoff complete

---

# Recommended execution order from today

1. Deploy latest app sync fixes
2. Validate Contacts list refresh
3. Complete real party signoff
4. Complete real worker scenario
5. Finalize control account breakdown
6. Verify dashboard parity
7. Produce legacy retirement proof
8. Only then execute controlled delete/archive

---

# What must NOT happen

- Do not drop duplicate tables before dependency proof
- Do not trust stored balances as GL
- Do not merge operational and GL into one unlabeled figure
- Do not hide mismatches with UI-only patches
- Do not delete historical journals instead of repairing them

---

# Final success definition

The system is considered clean only when:

- Trial Balance is journal-only
- Party GL slices are journal-derived
- Contacts list is operational-only and labeled
- Reconciliation explains differences
- Payment ↔ JE linkage is complete
- Worker flow passes real scenario
- Dashboard cash/bank matches journal logic
- No live duplicate ledger engine remains
- Legacy tables are either archived or proven removable
