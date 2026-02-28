# Next Step B – MacBook par apply karo

Contacts RLS (salesman strict isolation) + default Walk-in customer migrations GitHub pe push ho chuki hain. MacBook par ye steps follow karo.

## GitHub pull system (kisi bhi machine par)

```bash
cd /path/to/NEWPOSV3
git pull origin main
node scripts/run-migrations.js
```

Pull se latest migrations + code aate hain; `run-migrations.js` sirf **pending** migrations run karta hai (already applied skip).

**Done when:** Migrations applied + verify checklist (Section 3) pass.

## 1. Repo pull karo

```bash
cd ~/NEWPOSV3   # ya jahan bhi repo clone hai
git pull origin main
```

## 2. Migrations run karo

`.env.local` mein `DATABASE_URL` / `DATABASE_POOLER_URL` / `DATABASE_ADMIN_URL` set hona chahiye (MacBook / self-hosted Supabase ke liye).

```bash
node scripts/run-migrations.js
```

Ye script:
- `schema_migrations` check karegi
- Jo migrations abhi tak apply nahi hui, unhe run karegi (supabase-extract/migrations phir migrations/ folder se)
- Contacts RLS / default Walk-in wali migration(s) bhi apply ho jayengi (e.g. **contacts_rls_salesman_strict_isolation.sql** ya **customers_sales_rls_controlled_access.sql** — jo pending ho)
- **Identity model:** `identity_model_auth_user_id.sql`, `rpc_user_branches_accounts_auth_id_only.sql`, `fix_user_account_access_fk_to_auth_users.sql`, **`identity_model_enforce_fk_clean_orphans.sql`** — user_branches / user_account_access FKs hamesha `auth.users(id)`; orphan rows clean; Settings → Users mein branch/account **auth_user_id** only (unlinked par clear error toast). Verify: `docs/IDENTITY_MODEL_VERIFY_AND_FIX.sql`; audit: `docs/IDENTITY_MODEL_AUDIT.md`.

## 3. Verify

- [ ] **Salesman login** → Contacts list: sirf **default Walk-in customer** + **apne create kiye customers** dikhne chahiye (Suppliers/Workers/doosre salesmen ke customers nahi).
- [ ] **Admin login** → Contacts: sab contacts dikhne chahiye.
- [ ] **Salesman** → Sales form: Salesman dropdown disabled (sirf admin change kar sakta hai); created_by session se set ho.
- [ ] **Default customer** → Walk-in Customer delete/deactivate nahi ho sakta (UI + DB dono block).
- [ ] **Settings → Users** → Edit User → Branch/Account access save: linked user (auth_user_id) ke liye save hona chahiye; unlinked user par "must be linked" message.

---

**Summary:** `git pull` → `node scripts/run-migrations.js` → verify checklist above → done.
