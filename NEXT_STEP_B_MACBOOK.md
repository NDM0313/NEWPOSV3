# Next Step B – MacBook par apply karo

Contacts RLS (salesman strict isolation) + default Walk-in customer migrations GitHub pe push ho chuki hain. MacBook par ye steps follow karo.

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

## 3. Verify

- [ ] **Salesman login** → Contacts list: sirf **default Walk-in customer** + **apne create kiye customers** dikhne chahiye (Suppliers/Workers/doosre salesmen ke customers nahi).
- [ ] **Admin login** → Contacts: sab contacts dikhne chahiye.
- [ ] **Salesman** → Sales form: Salesman dropdown disabled (sirf admin change kar sakta hai); created_by session se set ho.
- [ ] **Default customer** → Walk-in Customer delete/deactivate nahi ho sakta (UI + DB dono block).

---

**Summary:** `git pull` → `node scripts/run-migrations.js` → verify checklist above → done.
