# Remaining Tasks – MacBook par apply karne ka guide

**Last updated:** Feb 2026  
**Branch:** main  
**Remote:** https://github.com/NDM0313/NEWPOSV3.git  

**Single source of truth:** Migration execution order = isi doc ka **Canonical Migration Execution Order**. Repo `migrations/` = yahi order. Out-of-order ya partial run se breakage avoid karne ke liye hamesha is order follow karo.

---

## 1. Code sync (MacBook)

```bash
cd /path/to/NEWPOSV3
git pull origin main
npm install
```

Phir **Canonical Migration Execution Order** wala section follow karo: order 1 se 97 tak jo migration files likhi hain, unhe SQL Editor (ya migration script ya VPS psql) se **sequence mein** run karo.

---

## 2. 🔒 Canonical Migration Execution Order (LOCKED)

**Yeh doc = source of truth.** Repo `migrations/` ki saari files yahi order mein chalaani hain.

- ⚠ **Do not change order.**
- ⚠ **Do not skip steps.**
- ⚠ **Always run in sequence.**

**Bootstrap (run first):** `migration_history_table.sql`, `erp_production_mode_table.sql` — then order 1–97 below.

Order: **Identity** → **Global identity/document** → **Contacts/Walk-in** → **Accounts/Payments** → **RLS (branches, sales, stock)** → **Audit/fix** → **RPC** → **Global permission** → **Feature/schema (rest).**

| # | Migration | Short description |
|---|-----------|-------------------|
| 1 | `auth_user_id_and_user_auth_link.sql` | Identity: auth_user_id, link auth ↔ public.users |
| 2 | `auth_user_id_functions.sql` | Identity: get_user_company_id / get_user_role (auth_user_id) |
| 3 | `users_id_default_uuid.sql` | Identity: default users.id on insert |
| 4 | `link_auth_users_to_public_users.sql` | Identity: link auth users → public.users |
| 5 | `ensure_quick_login_users_public.sql` | Identity: ensure login user has public.users row |
| 6 | `identity_model_auth_user_id.sql` | Identity: auth_user_id model support |
| 7 | `identity_model_enforce_fk_clean_orphans.sql` | Identity: enforce FK, clean orphans |
| 8 | `fix_user_account_access_fk_to_auth_users.sql` | Identity: user_account_access FK → auth.users |
| 9 | `add_user_code_autogenerate.sql` | Users: user code autogenerate |
| 10 | `add_user_role_salesman_staff_cashier.sql` | Users: salesman/staff/cashier roles |
| 11 | `global_identity_and_received_by.sql` | Global: received_by, activity_logs performed_by → auth.users |
| 12 | `global_document_sequences_company.sql` | Global: document_sequences_global, get_next_document_number_global |
| 13 | `backfill_created_by_auth_user_id.sql` | Backfill: created_by → auth_user_id on sales/payments etc. |
| 14 | `add_system_flags_to_contacts.sql` | Contacts: system flags (e.g. is_default walk-in) |
| 15 | `default_walkin_customer_mandatory.sql` | Walk-in: default walk-in customer + branch trigger |
| 16 | `contacts_worker_and_contact_groups.sql` | Contacts: worker type, contact groups |
| 17 | `contacts_global_customer_code_and_walkin.sql` | Contacts: code, CUS sequence, walk-in CUS-0000, RLS |
| 18 | `walkin_consolidation_single_per_company.sql` | Walk-in: one per company, reassign sales, delete extras |
| 19 | `walkin_strict_enforcement.sql` | Walk-in: unique index + CHECK CUS-0000 |
| 20 | `walkin_post_consolidation_audit.sql` | Walk-in: audit SELECTs (verify only) |
| 21 | `contacts_rls_salesman_strict_isolation.sql` | Contacts: RLS salesman strict isolation |
| 22 | `add_accounts_subtype_column.sql` | Accounts: subtype column |
| 23 | `ensure_ar_1100_and_fix_payment_journal.sql` | Accounts: AR 1100, create_payment_journal_entry SECURITY DEFINER |
| 24 | `accounts_rls_allow_default_accounts.sql` | Accounts RLS: default accounts (Cash, Bank) |
| 25 | `accounts_rls_allow_operator_inventory_payment.sql` | Accounts RLS: operator/inventory payment codes |
| 26 | `accounts_rls_allow_user_account_access.sql` | Accounts RLS: user_account_access SELECT |
| 27 | `accounts_rls_allow_sale_accounting_codes.sql` | Accounts RLS: AR/Sales for sale journal (fix 403) |
| 28 | `payments_rls_allow_insert.sql` | Payments RLS: SELECT/INSERT/UPDATE/DELETE by company+branch |
| 29 | `fix_payment_journal_ar_account_code.sql` | Payment journal: AR lookup fix |
| 30 | `create_sales_revenue_account.sql` | Accounts: sales revenue account |
| 31 | `branches_and_user_branches_rls.sql` | RLS: branches + user_branches |
| 32 | `user_branches_admin_manage_rls.sql` | RLS: admin manage user_branches |
| 33 | `user_account_access_and_rbac_rls.sql` | RLS: user_account_access + accounts RBAC |
| 34 | `sales_products_rls_role_based.sql` | RLS: sales/products by role + branch |
| 35 | `sales_rls_enforce_branch_id.sql` | RLS: sales branch_id enforcement |
| 36 | `customers_sales_rls_controlled_access.sql` | RLS: customers/sales controlled access |
| 37 | `stock_movements_rls_branch_based.sql` | RLS: stock_movements by company + branch |
| 38 | `activity_logs_table_if_not_exists.sql` | Activity logs table |
| 39 | `audit_logs_table_if_not_exists.sql` | Audit logs table |
| 40 | `fix_audit_logs_fk_and_document_sequences_rls.sql` | Audit logs FK, document_sequences RLS |
| 41 | `fix_users_rls_recursion.sql` | Fix users RLS recursion |
| 42 | `rpc_assign_user_branches_fk_fix.sql` | RPC: set_user_branches / set_user_account_access (FK-safe) |
| 43 | `rpc_user_branches_validate_auth_user.sql` | RPC: validate auth.users(id) |
| 44 | `rpc_user_branches_accounts_auth_id_only.sql` | RPC: user_branches/accounts auth_id only |
| 45 | `rpc_set_user_branches_and_accounts.sql` | RPC: set user branches and accounts |
| 46 | `user_accountability_global.sql` | Global: user accountability / permission helpers |
| 47 | `erp_permission_architecture_global.sql` | Global: is_admin_or_owner; sales, payments, journal_entries, contacts, etc. |
| 48 | `add_is_combo_product_to_products.sql` | Products: combo flag |
| 49 | `add_journal_entries_columns.sql` | Journal entries: extra columns |
| 50 | `backfill_studio_productions_for_sales.sql` | Studio: backfill productions for sales |
| 51 | `backfill_worker_ledger_from_journal.sql` | Worker ledger: backfill from journal |
| 52 | `create_product_combos_tables.sql` | Product combos tables |
| 53 | `enable_packing_setting.sql` | Packing setting |
| 54 | `enterprise_defaults_and_rls_isolation.sql` | Enterprise defaults, RLS isolation |
| 55 | `expense_categories_main_sub.sql` | Expense categories main/sub |
| 56 | `expense_categories_type_and_paid_to.sql` | Expense categories type, paid_to |
| 57 | `expenses_add_expense_no.sql` | Expenses: expense_no |
| 58 | `fix_auto_post_sale_account_fallbacks.sql` | Fix auto-post sale account fallbacks |
| 59 | `fix_current_balance_columns.sql` | Fix current_balance columns |
| 60 | `fix_get_sale_studio_charges_batch.sql` | Fix get_sale_studio_charges_batch |
| 61 | `fix_inventory_balance_on_conflict.sql` | Fix inventory balance on conflict |
| 62 | `fix_stock_movements_company_id.sql` | Fix stock_movements company_id |
| 63 | `fix_studio_document_number_std_prefix.sql` | Fix studio document number prefix |
| 64 | `inventory_balance_and_packing.sql` | Inventory balance and packing |
| 65 | `inventory_balance_on_conflict_fix.sql` | Inventory balance on conflict fix |
| 66 | `inventory_masters_units_brands.sql` | Inventory masters, units, brands |
| 67 | `invoice_template_system_phase_a.sql` | Invoice template phase A |
| 68 | `invoice_template_system_phase_b.sql` | Invoice template phase B |
| 69 | `invoice_template_system_phase_b_fix.sql` | Invoice template phase B fix |
| 70 | `ledger_master_and_entries.sql` | Ledger master and entries |
| 71 | `public_contact_registration_v2.sql` | Public contact registration v2 |
| 72 | `record_customer_payment_rpc.sql` | record_customer_payment RPC |
| 73 | `rental_module_schema.sql` | Rental module schema |
| 74 | `rental_security_document_columns.sql` | Rental security document columns |
| 75 | `sale_actions_logging.sql` | Sale actions logging |
| 76 | `sales_is_studio_column.sql` | Sales: is_studio column |
| 77 | `settings_mobile_barcode_scanner_policy.sql` | Settings: mobile barcode scanner policy |
| 78 | `settings_mobile_printer_barcode_policy.sql` | Settings: mobile printer barcode policy |
| 79 | `settings_mobile_sync_policy.sql` | Settings: mobile sync policy |
| 80 | `studio_assign_receive_workflow.sql` | Studio assign/receive workflow |
| 81 | `studio_orders_tables_if_not_exists.sql` | Studio orders tables |
| 82 | `studio_production_accounting_integrity.sql` | Studio production accounting integrity |
| 83 | `studio_production_module.sql` | Studio production module |
| 84 | `studio_production_phase3_sale_not_null_and_expected_date.sql` | Studio phase3 sale not null, expected_date |
| 85 | `studio_production_sale_linked.sql` | Studio production sale linked |
| 86 | `studio_production_stages_add_expected_cost.sql` | Studio stages expected cost |
| 87 | `studio_production_stages_no_auto_assign_guard.sql` | Studio stages no auto-assign guard |
| 88 | `studio_sale_sync_and_accountability.sql` | Studio sale sync and accountability |
| 89 | `studio_sales_integration_full.sql` | Studio sales integration full |
| 90 | `studio_sales_integration_verify.sql` | Studio sales integration verify |
| 91 | `update_units_table_for_decimal_system.sql` | Units table decimal system |
| 92 | `verify_accounts_rls_setup.sql` | Verify accounts RLS setup |
| 93 | `verify_stock_movements_schema.sql` | Verify stock_movements schema |
| 94 | `worker_ledger_document_no.sql` | Worker ledger document_no |
| 95 | `worker_ledger_entries_status.sql` | Worker ledger entries status |
| 96 | `worker_ledger_payable_status.sql` | Worker ledger payable status |
| 97 | `workers_sync_from_contacts.sql` | Workers sync from contacts |

---

## 3. Migration State Table (tracking)

Har environment par kaun si migration apply ho chuki hai, yahan tick karke track karo. **Applied?** = ✅ ya ❌.

| # | Migration | Applied? | Notes |
|---|-----------|----------|-------|
| 1 | `auth_user_id_and_user_auth_link.sql` | | |
| 2 | `auth_user_id_functions.sql` | | |
| 3 | `users_id_default_uuid.sql` | | |
| 4 | `link_auth_users_to_public_users.sql` | | |
| 5 | `ensure_quick_login_users_public.sql` | | |
| 6 | `identity_model_auth_user_id.sql` | | |
| 7 | `identity_model_enforce_fk_clean_orphans.sql` | | |
| 8 | `fix_user_account_access_fk_to_auth_users.sql` | | |
| 9 | `add_user_code_autogenerate.sql` | | |
| 10 | `add_user_role_salesman_staff_cashier.sql` | | |
| 11 | `global_identity_and_received_by.sql` | | |
| 12 | `global_document_sequences_company.sql` | | |
| 13 | `backfill_created_by_auth_user_id.sql` | | |
| 14 | `add_system_flags_to_contacts.sql` | | |
| 15 | `default_walkin_customer_mandatory.sql` | | |
| 16 | `contacts_worker_and_contact_groups.sql` | | |
| 17 | `contacts_global_customer_code_and_walkin.sql` | | |
| 18 | `walkin_consolidation_single_per_company.sql` | | |
| 19 | `walkin_strict_enforcement.sql` | | |
| 20 | `walkin_post_consolidation_audit.sql` | | |
| 21 | `contacts_rls_salesman_strict_isolation.sql` | | |
| 22–97 | *(see Canonical table above)* | | |

**Tip:** Naya environment par 1 se 96 tak sequence run karke is table mein ✅ mark karo. Re-run mat karo agar already applied ho.

---

## 4. DB Guard (optional but recommended)

Accidental re-run / parallel run se bachne ke liye migration lock table use kar sakte ho. **Pehle** koi migration chalane se pehle check karo: agar `migration_lock` locked hai to manually unlock karke hi run karo.

```sql
-- Create once (e.g. in SQL Editor)
CREATE TABLE IF NOT EXISTS public.migration_lock (
  id boolean PRIMARY KEY DEFAULT true,
  locked_at timestamptz DEFAULT now(),
  CONSTRAINT one_row CHECK (id = true)
);

-- Before running migrations: check
-- SELECT * FROM public.migration_lock;  --> if row exists and you did not lock it, do not run.

-- Lock (manual, when starting migration run):
INSERT INTO public.migration_lock (id, locked_at) VALUES (true, now())
ON CONFLICT (id) DO UPDATE SET locked_at = now();

-- Unlock (after all migrations done):
DELETE FROM public.migration_lock WHERE id = true;
```

Agar tumhara migration runner `migration_lock` check karta ho to use karo; warna SQL Editor se manually run karte waqt khud lock/unlock karo.

---

## 5. Validation script (post-migration)

Migrations run karne ke baad state verify karne ke liye:

```bash
# Supabase SQL Editor mein scripts/validate-migration-state.sql run karo
# ya: psql "$DATABASE_URL" -f scripts/validate-migration-state.sql
```

Script **PASS** ya **FAIL** print karega: FK targets, RLS policies, walk-in uniqueness, document_sequences_global, created_by consistency. Fail hone par output mein reason dikhega.

---

## 6. 🔐 Immutable Migration Mode

**Goal:** Freeze migration system — no accidental re-run, no partial drift, no order mismatch, no silent schema change.

### Migration history tracking

Table: `public.migration_history` (created by `migrations/migration_history_table.sql`).

- **Columns:** `id`, `filename` (UNIQUE), `applied_at`.
- **Process:** Before running each migration:
  1. `SELECT 1 FROM public.migration_history WHERE filename = '<migration_file>';`
  2. If row **exists** → **SKIP** (already applied).
  3. If **not exists** → run the migration file.
  4. After **success** → `INSERT INTO public.migration_history(filename) VALUES ('<migration_file>');`

Yeh process **scripts/run-migrations-immutable.sh** follow karta hai: canonical order mein har file ke liye check → run → insert. Duplicate migration kabhi run nahi hoti.

### Validation enforcement

Run ke **end** par script **scripts/validate-migration-state.sql** chalati hai.

- **PASS** → deployment OK.
- **FAIL** → **abort deployment** (script exit 1). Output mein reason dikhega; fix karke phir run karo.

### Production guard (optional)

Table: `public.erp_production_mode` (created by `migrations/erp_production_mode_table.sql`).

- Agar is table mein row hai (`enabled = true`): environment **production** maana jata hai.
- **Rules:** No destructive migration allowed: no **DROP TABLE**, no **ALTER TYPE** (enum/type change). Risky migrations pehle check karo; production par manual override ke bina mat chalao.
- Production mode off karne ke liye: `DELETE FROM public.erp_production_mode WHERE enabled = true;` (sirf authorized).

### No manual schema edits

- Schema changes **sirf** migration files se: canonical order follow karke, history mein record ho.
- Direct SQL Editor se table/column add/remove **na** karo (drift ho jata hai). Naya change = naya migration file, doc order update, phir immutable runner se run.

**Summary:** migration_history = audit trail, no duplicate run; validation = hard gate (FAIL → abort); production guard = no destructive change when enabled; manual schema edits not allowed.

---

## 7. 🔁 Rollback & Backup Strategy

**Goal:** Before every migration run — auto backup, timestamped dump, rollback if validation FAIL.

### Backup before run

**scripts/run-migrations-immutable.sh** runs a **pre-run backup** before applying any migration:

- **Command:** `pg_dump "$DATABASE_URL" --format=custom --file=backups/erp_backup_<timestamp>.dump`
- **Location:** `backups/erp_backup_YYYYMMDD_HHMMSS.dump` (repo root `backups/` folder; create ho jata hai agar nahi hai).
- Backup **har run se pehle** liya jata hai; purane backups delete nahi kiye jate (manual cleanup agar chahiye).

### Validation gate

Migrations run hone ke **baad** script **scripts/validate-migration-state.sql** chalati hai.

- **PASS** → deployment OK.
- **FAIL** → script **abort** (exit 1). Message: **"Migration failed. Restore from last backup."** Backup **delete nahi** hota — restore ke liye use karo.

### Restore method

Agar validation FAIL ho ya migration ke baad DB theek nahi lage, last backup se restore karo:

```bash
pg_restore --clean --if-exists \
  -d "$DATABASE_URL" \
  backups/<filename>.dump
```

- `<filename>` = woh dump file jo run se pehle bani thi, e.g. `erp_backup_20260226_143022.dump`.
- `--clean --if-exists` = existing objects drop karke restore (conflicts kam).
- Restore ke baad phir se validation chala lo; fix karke migration dobara run karna ho to backup pehle hi bann chuka hoga.

**Summary:** Pre-run backup → migrations → validation; FAIL → restore from last backup; backups retain for rollback.

---

## 8. Migrations run karne ke 3 tareeke

### A) Supabase SQL Editor

1. Supabase project → **SQL Editor**.
2. Canonical order (1 → 97) follow karke har file ka content copy karke paste karo, **Run** (ek ke baad ek).

### B) Migration script (repo)

- **Immutable (recommended):** `./scripts/run-migrations-immutable.sh` — migration_history check karta hai, duplicate skip, run ke baad validation; FAIL par abort. `DATABASE_URL` set karke chalao.
- **Legacy:** `node scripts/run-migrations.js` (agar configured ho) — script ke andar file list **isi doc ke Canonical order** jaisi honi chahiye.
- **VPS:** `ssh dincouture-vps "cd /root/NEWPOSV3 && bash deploy/run-migrations-vps.sh"` — order ke liye script mein same list use karo. Immutable mode ke liye `scripts/run-migrations-immutable.sh` use kar sakte ho (VPS par DATABASE_URL set karke).

### C) VPS / psql (direct)

Canonical table mein diye gaye filenames ko same order mein `for f in ...` mein daal ke chalao. Example (pehle 20):

```bash
ssh dincouture-vps "cd /root/NEWPOSV3 && for f in auth_user_id_and_user_auth_link auth_user_id_functions users_id_default_uuid link_auth_users_to_public_users ensure_quick_login_users_public identity_model_auth_user_id identity_model_enforce_fk_clean_orphans fix_user_account_access_fk_to_auth_users add_user_code_autogenerate add_user_role_salesman_staff_cashier global_identity_and_received_by global_document_sequences_company backfill_created_by_auth_user_id add_system_flags_to_contacts default_walkin_customer_mandatory contacts_worker_and_contact_groups contacts_global_customer_code_and_walkin walkin_consolidation_single_per_company walkin_strict_enforcement walkin_post_consolidation_audit; do docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -f - < migrations/\${f}.sql || true; done"
```

Poori list ke liye **Canonical Migration Execution Order** table se filenames (`.sql` bina) same order mein use karo.

---

## 9. Post-migration checks

| Check | Kaise verify |
|-------|----------------|
| **Walk-in count** | `SELECT company_id, COUNT(*) FROM contacts WHERE system_type = 'walking_customer' GROUP BY company_id;` — har company ke liye 1. |
| **Sale 403** | Non-admin user se ek sale save karo — AR/Sales 403 nahi aana chahiye. |
| **Ledger** | Walk-in customer select karke ledger kholo — saari walk-in sales dikhni chahiye. |
| **User branch access** | Settings → User Management → Edit User → Branch Access → Save — FK error na aaye. |

Validation script bhi chala lo: `scripts/validate-migration-state.sql` → **PASS** aana chahiye.

---

## 10. Docs reference

- **User / Branch access:** `docs/USER_ACCESS_MANAGEMENT_RBAC.md`, `docs/USER_ACCESS_SETTINGS_FULL_REPORT.md`
- **MacBook setup + tasks:** `docs/MACBOOK_SETUP_AND_REMAINING_TASKS.md`
- **Verification SQL:** `docs/USER_ACCESS_SETTINGS_VERIFY.sql`
- **User management access fix:** `docs/USER_MANAGEMENT_ACCESS_FIX.md`

---

## 11. Checklist (MacBook)

- [ ] `cd /path/to/NEWPOSV3`
- [ ] `git pull origin main`
- [ ] `npm install`
- [ ] Migrations run (Canonical order 1–97): SQL Editor **ya** script **ya** VPS psql
- [ ] Migration State Table mein applied mark karo
- [ ] `scripts/validate-migration-state.sql` run karke **PASS** verify karo
- [ ] Post-migration checks: walk-in count, sale 403, ledger, user branch save
- [ ] Optional: smoke tests (login, one sale, one purchase, ledger)

---

**Summary:** Migration execution ka **single source of truth** yahi doc hai. Repo = doc order. Order change mat karo; skip mat karo; hamesha sequence follow karo. Validation script se state verify karo.
