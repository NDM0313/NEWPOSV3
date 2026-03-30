# Delete / Archive Candidates (Review Only — Phase 1)

**Do not delete or archive until phase 2 sign-off.** This lists **candidates** with file path and rationale.

| File / artifact | Reason | Legacy dependency | Safe to archive? | Safe to delete? | Replacement / notes |
|-----------------|--------|-------------------|------------------|-----------------|---------------------|
| `erp-mobile-app/src/components/accounting/AccountingModule.tsx` | **Mock-only** accounting UI; **no imports** found outside itself | None | Yes | **Candidate delete** after confirm no dynamic import / future use | Live app uses `AccountsModule` in `App.tsx` ~451 |
| `complete-migration.js` (repo root) | Creates legacy **`chart_accounts`** / **`account_transactions`** schema | **High** | Yes | **No** | Keep in archive for history; do not run |
| `remove-duplicate-accounting-tables.js` | **Destructive** drop list | **Extreme** | Yes | **No** | Phase 2 DBA review only |
| `src/app/services/ledgerService.ts` | No-op stubs; duplicate concept removed per file header | None in **new** code if imports gone | Yes | **Only after** grep shows zero imports | Use `journal_entries` services |
| `scripts/run-supplier-ledger-verification.js` | Targets **`ledger_master`/`ledger_entries`** in DB | Legacy DB | Yes | **No** | Replace with journal-based verification when DB clean |
| Old audit SQL under `docs/audit/*` referencing `ledger_entries` | Documentation | Legacy | Yes | **No** | Keep until reconciliation docs updated |
| `verify-accounting-integrity.js` | Introspection for legacy table presence | Legacy | Yes | **No** | Update messages after phase 2 |

---

## High-risk areas (not delete candidates — **fix first**)

| Path | Why risky |
|------|-----------|
| `erp-mobile-app/src/api/accounts.ts` `recordWorkerPayment` | **Bypasses** `payments` + `journal_entries`; will desync from web |
| `src/app/components/accounting/AccountingDashboard.tsx` summary `useMemo` | Operating AR/AP **not** from RPC — reconciles poorly with Contacts |
| `AccountingDashboard.tsx` receivables/payables tabs | **Document `due`** vs GL |

---

## Final summary (phase 2 planning)

### LIVE TABLES TO KEEP (app + migrations reference)

`accounts`, `journal_entries`, `journal_entry_lines`, `payments`, `payment_allocations`, `contacts`, document tables (`sales`, `purchases`, `expenses`, …), `worker_ledger_entries` (auxiliary but actively written), supporting RPCs (`get_contact_balances_summary`, `get_contact_party_gl_balances`, `record_payment_with_accounting`, customer ledger RPCs, etc.).

### LEGACY TABLES TO REVIEW (DB phase 2)

`chart_accounts`, `account_transactions`, `accounting_audit_logs`, `automation_rules`, `ledger_master`, `ledger_entries`, plus **`backup_cr_*` / `backup_pf145_*`** if present in deployment.

### FRONTEND FILES TO REFACTOR (priority)

1. `erp-mobile-app/src/api/accounts.ts` — align **`recordWorkerPayment`** with `src/app/services/workerPaymentService.ts`.
2. `src/app/components/accounting/AccountingDashboard.tsx` — reconcile summary + tabs with **`get_contact_balances_summary`** or document dual semantics.
3. `erp-mobile-app/src/components/dashboard/DashboardModule.tsx` — optional: use `get_financial_dashboard_metrics` for P&L alignment.
4. `erp-mobile-app/src/api/customerLedger.ts` — align branch policy with selected branch vs company-wide (product decision).
5. Remove or gate **`AccountingModule.tsx`** mock.

### HIGH-RISK DELETE CANDIDATES

`remove-duplicate-accounting-tables.js`, destructive company reset SQL, any script that **DROP**s legacy without backup.

### SAFE ARCHIVE CANDIDATES

Historical migration JS (`complete-migration.js`), old supplier ledger verification scripts, **after** git tag and backup policy.

### PHASE 2 CLEANUP PLAN (outline)

1. **Inventory production DB** — confirm row counts on legacy tables; verify no ETL/reports depend on them.  
2. **Normalize worker payment** — single code path: `payments` + JE + `worker_ledger_entries`.  
3. **Define one AR/AP “headline” number** per surface (operational vs GL) and wire UI labels.  
4. **Retire** `ledgerService` stubs after import cleanup; **retain** migrations for history.  
5. **Legacy table removal** — last step, after freeze period and backups (`backup_cr_*` pattern already in `scripts/company_reset_backup.sql`).

