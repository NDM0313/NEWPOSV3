# Web + Mobile Same Data (One Database)

**Standard method (admin full access dono par):** `deploy/ADMIN_ACCESS_STANDARD_METHOD.md` dekhein.

## Why data looks different

- **Web (erp.dincouture.pk)** and **Mobile** must use the **same** Supabase backend: `https://supabase.dincouture.pk` and the **same anon key** (Kong JWT).
- If web was on an old build that requested `created_by_user:users(...)` for purchases/rentals, you get **400 PGRST200** and purchases/rentals fail to load → different or empty data.
- If mobile gets **403 on `/auth/v1/user`**, session check fails → app may show cached/demo data or errors.

## 1. Web ERP – fix PGRST200 and show same data

- Code is already fixed: **no** `created_by_user:users(...)` in `purchaseService` or `rentalService` (production DB has no FK purchases/rentals → users).
- You must **rebuild and redeploy** the web app so the live bundle has this fix:
  ```bash
  # On VPS (e.g. /root/NEWPOSV3)
  git fetch origin main && git reset --hard origin/main
  docker compose -f deploy/docker-compose.prod.yml --env-file .env.production up -d --build
  ```
- Ensure `.env.production` has:
  - `VITE_SUPABASE_URL=https://supabase.dincouture.pk`
  - `VITE_SUPABASE_ANON_KEY=<Kong anon JWT>` (same as Supabase/Kong env)

## 2. Mobile app – same backend, no 403

- **erp-mobile-app/.env** must use the **same** URL and anon key as web:
  - `VITE_SUPABASE_URL=https://supabase.dincouture.pk`
  - `VITE_SUPABASE_ANON_KEY=<same Kong anon key>`
- Restart mobile dev server after changing `.env`: `cd erp-mobile-app && npm run dev`.

### If mobile shows 403 on `GET .../auth/v1/user`

- **Same database:** Both apps already point to supabase.dincouture.pk; 403 is usually auth/CORS, not a different DB.
- **Check:**
  1. Kong/Supabase **Redirect URLs** (e.g. Auth → URL config): add `http://localhost:5174`, `https://erp.dincouture.pk`, and if you use Capacitor: `capacitor://localhost`, `ionic://localhost`.
  2. **CORS:** Kong must allow your app origins (e.g. `https://erp.dincouture.pk`, `http://localhost:5174`). Self-hosted Supabase/Kong often allows all; if you restricted origins, add these.
  3. **Anon key:** Must be the **same** JWT as used by Kong (from Supabase stack `.env` / `SUPABASE_ANON_KEY`). If key is wrong, auth can return 403.

## 3. Auto-fix: same data dono par

- **Env sync:** Root se mobile tak Supabase config auto copy:
  ```bash
  npm run sync:mobile-env
  ```
  (Root `.env.local` / `.env.production` se `VITE_SUPABASE_*` → `erp-mobile-app/.env`.)
- **Mobile dev (sync + run):**
  ```bash
  npm run mobile:dev
  ```
- **Admin on mobile:** Login ke baad branch list mein **"All Branches"** option admin ko dikhta hai (Web jaisa – sari branches ka data).

## 4. Summary

| Item | Action |
|------|--------|
| Web + Mobile same data | `npm run sync:mobile-env` se mobile env = root env; dono same backend |
| Web PGRST200 / purchases–rentals 400 | Rebuild and redeploy web (current code has no users join) |
| Mobile 403 on auth | Same anon key as web; add redirect URLs and CORS for localhost:5174 / erp.dincouture.pk |

After this, **ndm313@yahoo.com** (admin) will see the **same** data on web and mobile.
