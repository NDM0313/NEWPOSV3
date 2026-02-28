# Remaining Tasks – MacBook par apply karne ka guide

**Last updated:** Feb 2026  
**Branch:** main  
**Remote:** https://github.com/NDM0313/NEWPOSV3.git  

Sab changes add, commit aur push ho chuke hain (e.g. commit 5bc1194 – 52 files: new migrations, docs, app changes).  
MacBook par code sync karke migrations is order mein run karein.

---

## 1. Code sync (MacBook)

```bash
cd /path/to/NEWPOSV3
git pull origin main
npm install
```

Phir **docs/REMAINING_TASKS_APPLY_ON_MACBOOK.md** (yahi file) khol ke **Migrations run order** wala section follow karo: order 1 se 15 tak jo migration files likhi hain, unhe SQL Editor (ya apne migration runner) se run karo.

---

## 2. Migrations run order (1–15)

Order ye rakhna hai: **Identity** → **Contacts / Walk-in** → **Accounts / Payments RLS** → **Other RLS** → **Global (user accountability / RPC)**.

| # | Migration file | Short description |
|---|----------------|-------------------|
| 1 | `auth_user_id_and_user_auth_link.sql` | Identity: add auth_user_id, link auth ↔ public.users |
| 2 | `auth_user_id_functions.sql` | Identity: get_user_company_id / get_user_role support auth_user_id |
| 3 | `users_id_default_uuid.sql` | Identity: default for users.id on insert |
| 4 | `link_auth_users_to_public_users.sql` | Identity: link auth users to public.users (by email/id) |
| 5 | `ensure_quick_login_users_public.sql` | Identity: ensure login user has public.users row |
| 6 | `add_system_flags_to_contacts.sql` | Contacts: system flags (e.g. is_default walk-in) |
| 7 | `default_walkin_customer_mandatory.sql` | Contacts/Walk-in: default walk-in customer + branch trigger |
| 8 | `contacts_worker_and_contact_groups.sql` | Contacts: worker type, contact groups |
| 9 | `accounts_rls_allow_default_accounts.sql` | Accounts RLS: default accounts (e.g. Cash, Bank) |
| 10 | `accounts_rls_allow_operator_inventory_payment.sql` | Accounts RLS: operator/inventory payment codes |
| 11 | `branches_and_user_branches_rls.sql` | RLS: branches + user_branches select (own rows) |
| 12 | `user_branches_admin_manage_rls.sql` | RLS: admin INSERT/UPDATE/DELETE on user_branches |
| 13 | `user_account_access_and_rbac_rls.sql` | RLS: user_account_access + accounts RBAC |
| 14 | `sales_products_rls_role_based.sql` | RLS: sales/products by role + branch |
| 15 | `sales_rls_enforce_branch_id.sql` | RLS: sales branch_id enforcement |
| 16 | `rpc_assign_user_branches_fk_fix.sql` | RPC: set_user_branches / set_user_account_access (FK-safe) |
| 17 | `user_accountability_global.sql` | Global: user accountability / permission helpers |

**Note:** 16–17 bhi run karein agar pehle run nahi kiye (user branch access fix + global helpers).

---

## 3. Migrations run karne ke 3 tareeke

### A) Supabase SQL Editor

1. Supabase project kholo (Cloud ya self-hosted dashboard).
2. **SQL Editor** → New query.
3. Har migration file khol ke (e.g. `migrations/auth_user_id_and_user_auth_link.sql`) poora content copy karke paste karo, phir **Run**.

### B) Migration script (repo)

Agar `scripts/run-migrations.js` ya `deploy/run-migrations-vps.sh` use karte ho:

- **Local (Node):** `node scripts/run-migrations.js` (agar configured ho).
- **VPS:** `ssh dincouture-vps "cd /root/NEWPOSV3 && bash deploy/run-migrations-vps.sh"` — ye `migrations/*.sql` ko apne order se chala sakta hai; order ke liye script ke andar file list check karo.

### C) VPS / psql (direct)

```bash
# MacBook se (SSH + psql on VPS)
ssh dincouture-vps "cd /root/NEWPOSV3 && for f in auth_user_id_and_user_auth_link auth_user_id_functions users_id_default_uuid link_auth_users_to_public_users ensure_quick_login_users_public add_system_flags_to_contacts default_walkin_customer_mandatory contacts_worker_and_contact_groups accounts_rls_allow_default_accounts accounts_rls_allow_operator_inventory_payment branches_and_user_branches_rls user_branches_admin_manage_rls user_account_access_and_rbac_rls sales_products_rls_role_based sales_rls_enforce_branch_id rpc_assign_user_branches_fk_fix user_accountability_global; do docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < migrations/\${f}.sql || true; done"
```

(Har file ke liye `migrations/<name>.sql` hona chahiye; agar koi file missing ho to skip ho jayega.)

---

## 4. Post-migration checks

| Check | Kaise verify |
|-------|----------------|
| **Walk-in count** | Contacts list mein default walk-in customer (type customer, is_default ya system) dikhna chahiye. |
| **Sale 403** | Ek sale create karke save karo; 403 nahi aana chahiye (RLS + branch_id sahi ho). |
| **Ledger** | Accounting / Ledger page khol ke entries load hon; error na ho. |
| **User branch access** | Settings → User Management → Edit User → Branch Access → Save; FK error na aaye (RPC apply ho to). |

---

## 5. Docs reference

- **User / Branch access fix:** `docs/USER_ACCESS_MANAGEMENT_RBAC.md`, `docs/USER_ACCESS_SETTINGS_FULL_REPORT.md`
- **MacBook setup + remaining tasks:** `docs/MACBOOK_SETUP_AND_REMAINING_TASKS.md`
- **Verification SQL:** `docs/USER_ACCESS_SETTINGS_VERIFY.sql`

---

## 6. Checklist (MacBook)

- [ ] `cd /path/to/NEWPOSV3`
- [ ] `git pull origin main`
- [ ] `npm install`
- [ ] Migrations run (order 1–15/17): SQL Editor **ya** migration script **ya** VPS psql
- [ ] Post-migration verify: walk-in count, sale 403, ledger, user branch save
- [ ] Optional: smoke tests (login, one sale, one purchase, ledger)

---

**Summary:** MacBook par pehle `git pull origin main` aur `npm install`, phir isi doc ke **Migrations run order** wale table (1 se 15/17) ke hisaab se migration files SQL Editor (ya migration script ya VPS psql) se run karo, phir post-migration checks karo.
