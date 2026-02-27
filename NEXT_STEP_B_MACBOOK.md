# Next Step B – MacBook par apply karo

Contacts RLS (salesman strict isolation) + default Walk-in customer migrations GitHub pe push ho chuki hain. MacBook par ye steps follow karo.

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
- Jo migrations abhi tak apply nahi hui, unhe run karegi
- **contacts_rls_salesman_strict_isolation.sql** bhi apply ho jayegi (agar pehle apply nahi hui)

## 3. Verify

- Salesman login karke Contacts list kholo: sirf **default Walk-in customer** + **apne create kiye customers** dikhne chahiye (Suppliers/Workers/doosre salesmen ke customers nahi).
- Admin se sab contacts dikhne chahiye.

---

**Summary:** `git pull` → `node scripts/run-migrations.js` → done.
