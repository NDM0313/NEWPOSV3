# Company Transaction Reset – Result

**Date:** 2026-03-18  
**Mode:** Production-safe, fully automated  
**Target company ID:** `c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee`

## Goal

Delete **only** business/operational transactions for this company and reset it to a clean state.  
**Preserved:** company record, branches, users, profiles, roles, permissions, settings, chart of accounts (accounts), account groups/types, products, contacts, and other master/config data.

## Execution Summary

| Step        | Script                          | Status   |
|------------|----------------------------------|----------|
| Inspect    | `scripts/company_reset_inspect_schema.sql` | Done (live schema + FKs) |
| Preview    | `scripts/company_reset_preview.sql`         | Done (counts before reset) |
| Backup     | `scripts/company_reset_backup.sql`          | Done (backup_cr_* tables) |
| Reset      | `scripts/company_reset_final.sql`           | Done (ordered deletes) |
| Cleanup    | `scripts/company_reset_activity_logs_cleanup.sql` | Done (7 trigger-inserted activity_logs) |
| Verify     | `scripts/company_reset_verify.sql`           | Done (all transactional counts 0) |

## Preview Counts (Before Reset)

| Table                    | Count |
|--------------------------|-------|
| activity_logs            | 89    |
| journal_entries          | 114   |
| journal_entry_lines      | 240   |
| payments                 | 18    |
| ledger_entries           | 8     |
| ledger_master            | 3     |
| worker_ledger_entries    | 8     |
| stock_movements          | 21    |
| sale_charges             | 12    |
| sales                    | 7     |
| purchase_items           | 8     |
| purchases                | 4     |
| studio_production_stages | 5     |
| studio_productions       | 2     |
| sale_shipments           | 2     |
| rental_items             | 2     |
| rentals                  | 2     |
| sale_return_items        | 1     |
| sale_returns             | 1     |
| expenses                 | 1     |
| courier_shipments        | 0     |
| print_logs               | 0     |
| share_logs               | 0     |
| purchase_returns          | 0     |
| purchase_return_items    | 0     |
| sale_items               | 0     |

## Verification (After Reset)

- **Transactional data for company:** All 25 tables show **0** rows for this company.
- **Preserved:** companies 1, accounts 23, branches 1, products 5, contacts 10.

## Files Used

| Deliverable   | File |
|---------------|------|
| Preview       | `scripts/company_reset_preview.sql` |
| Backup        | `scripts/company_reset_backup.sql` |
| Final reset   | `scripts/company_reset_final.sql` |
| Verification  | `scripts/company_reset_verify.sql` |
| Activity cleanup | `scripts/company_reset_activity_logs_cleanup.sql` |
| Schema inspect | `scripts/company_reset_inspect_schema.sql` |

## Backup

Backup data is in tables with prefix `backup_cr_` in the same database (e.g. `backup_cr_sales`, `backup_cr_journal_entries`). Restore would require re-inserting from these tables if needed.

## Acceptance Criteria

- [x] Company still exists  
- [x] Chart of accounts / setup still exists (23 accounts)  
- [x] Products (5) and contacts (10) remain  
- [x] All business transactions for company `c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee` deleted  
- [x] No FK errors during delete  
- [x] Frontend can open clean for this company with zero transactional history  

## Notes

- Reset was applied on the **live VPS** database (supabase-db).
- Warnings “No Accounts Receivable account found for payment reversal” appeared during payment deletes (trigger logic); they did not affect the outcome.
- A second pass deleted 7 `activity_logs` rows that were re-inserted by triggers during the reset; the final script now includes a final `activity_logs` delete pass for future runs.

---

## Selective / complete reset (Settings UI + RPC, 2026-06)

**Migration:** `migrations/20260610120000_company_reset_selective_domains.sql`  
**UI:** Settings → Data & backup → Company Reset (admin/owner only)  
**Service:** `src/app/services/companyResetService.ts` — `preview_company_transaction_reset` / `execute_company_transaction_reset` with optional `p_options` JSONB.

### Deploy (VPS)

After merge, apply the migration on production Postgres (same path as other `migrations/` files), e.g. via your usual Supabase/migration runner on `dincouture-vps`. Until applied, the UI will error if `p_options` overload is missing.

### Verify checklist

1. **Transactional only** — Mode: Transaction reset. Preview shows transactional counts; preserved contacts/products/accounts unchanged. Confirm with `RESET`. After run: sales/purchases/journal = 0; contacts and products unchanged.
2. **Custom** — Mode: Custom; uncheck all master domains → same as (1). Check only Products → preview master `products` > 0; confirm `RESET ALL`; products = 0, contacts remain.
3. **Complete** — Mode: Complete (A–Z). Preview shows all master counts; confirm `RESET ALL`. After run: 0 sales, 0 contacts, 0 products; COA re-seeded via `defaultAccountsService.ensureDefaultAccounts`; branches, users, settings still present.
4. **Audit** — Row in `company_reset_audit_logs` includes resolved `options` in `precheck_counts` and per-table `deleted` counts.

### Confirmation phrases

| Selection | Phrase |
|-----------|--------|
| Transactional only | `RESET` |
| Any master domain or complete mode | `RESET ALL` |

### Never deleted (all modes)

`companies`, `branches`, `users`, company-scoped settings (`settings`, `module_configs`, `feature_flags`, `business_settings`, etc.).
