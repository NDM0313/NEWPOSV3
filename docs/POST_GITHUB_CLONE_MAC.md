# Post–GitHub clone — Mac web dev (canonical)

Use this after `git clone` or `git pull` on a Mac. **Do not** use outdated [`MACBOOK_SETUP_AND_REMAINING_TASKS.md`](MACBOOK_SETUP_AND_REMAINING_TASKS.md) (old branch / cloud Supabase).

---

## 1. Sync repo

```bash
cd NEWPOSV3
git checkout main
git pull origin main
npm ci
```

---

## 2. Local env (required)

Create **`.env.local`** in repo root (copy from [`.env.example`](../.env.example)):

```env
VITE_SUPABASE_URL=https://supabase.dincouture.pk
VITE_SUPABASE_ANON_KEY=<from VPS — see below>
```

Get anon key from VPS:

```bash
ssh dincouture-vps "grep '^ANON_KEY=' /root/supabase/docker/.env | head -1"
```

Or run: `bash scripts/sync-local-env-from-vps.sh` if present.

Restart dev after changes: `npm run dev` → http://localhost:5173

---

## 3. If login shows “Network error” / 502

1. Check upstream (not 502):

   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' https://supabase.dincouture.pk/auth/v1/health
   ```

   - **502** → Kong down → on VPS: `cd /root/NEWPOSV3 && git pull && bash deploy/deploy.sh`
   - **401** without apikey → Kong up (normal)

2. Proxy probe (dev server running):

   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' \
     -X POST 'http://127.0.0.1:5173/supabase/auth/v1/token?grant_type=password' \
     -H "apikey: $VITE_SUPABASE_ANON_KEY" \
     -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
     -H 'Content-Type: application/json' \
     -d '{"email":"x@y.com","password":"wrong"}'
   ```

   - **400** → OK (use real password)
   - **401** → wrong/demo anon key → fix `.env.local`
   - **502** → run VPS deploy (step 1)

3. Profile missing after auth: [`deploy/LOCALHOST_LOGIN_DEBUG.md`](../deploy/LOCALHOST_LOGIN_DEBUG.md)

---

## 4. Production smoke (web only)

After localhost login works:

| Step | Action |
|------|--------|
| 1 | Hard refresh https://erp.dincouture.pk (Ctrl+Shift+R) |
| 2 | Smoke: dashboard, sales, expenses, purchases |
| 3 | See [`WEB_PERFORMANCE_OPTIMIZATION_2026-06-03.md`](WEB_PERFORMANCE_OPTIMIZATION_2026-06-03.md) office checklist |

---

## 5. Git workflow

[`GIT_WORKFLOW_RULES.txt`](../GIT_WORKFLOW_RULES.txt): **pull before work**, **push after work**, stay on `main`.

---

## 6. Blank page / React `Children` error after pull

If the app is white or the console shows `Cannot set properties of undefined (setting 'Children')`:

1. Hard refresh (Ctrl+Shift+R).
2. Unregister the PWA service worker (DevTools → Application).
3. Pull latest `main` (includes `vendor-react` chunk fix in `vite.config.ts`).

---

*Last verified: 2026-06-04 — Kong 502 fixed via `deploy/deploy.sh`; React vendor chunk unified.*
