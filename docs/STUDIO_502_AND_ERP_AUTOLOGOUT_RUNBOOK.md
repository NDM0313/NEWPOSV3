# Studio 502 + ERP Auto-Logout – Runbook

**Related:** **`docs/MASTER_AUTH_AND_KONG_RUNBOOK.md`** – auth, 502, 401, Kong index.

---

## 1. Host mapping summary

| Host | Purpose | Normal behavior |
|------|---------|-----------------|
| **supabase.dincouture.pk** | Supabase API (Kong: auth, rest, storage, functions) | Root returns **JSON** message (e.g. "Use /auth/v1/health..."). **Not an error.** |
| **studio.dincouture.pk** | Supabase Studio (DB UI, tables, SQL) | Loads Studio; may redirect to `/project/default`. **502 = routing/network issue.** |
| **erp.dincouture.pk** | ERP app (frontend) | Login page → after login, **session should persist**; dashboard stays open. **Auto-logout after ~1s = bug.** |

---

## 2. Studio 502 – cause and fix

**Symptom:** https://studio.dincouture.pk returns **502 Bad Gateway**.

**Root cause:** Traefik (e.g. `dokploy-traefik`) routes `studio.dincouture.pk` to `http://supabase-studio:3000`. Traefik was only on `dokploy-network`; **supabase-studio** runs on **supabase_default** only. So Traefik could not resolve or reach `supabase-studio:3000` → 502.

**Fix (already applied on VPS):** Connect Traefik to `supabase_default` so it can reach the Studio container:

```bash
ssh dincouture-vps "docker network connect supabase_default dokploy-traefik"
```

**Persistent (after restart):** The deploy script runs `deploy/ensure-studio-traefik-network.sh`, which does the same connect. So after each full deploy, Studio should keep working. If you restart only Traefik or only Supabase, run once:

```bash
ssh dincouture-vps "cd /root/NEWPOSV3 && bash deploy/ensure-studio-traefik-network.sh"
```

**Verify:**  
- `curl -sI https://studio.dincouture.pk` → **307** (redirect to /project/default) or **200** → OK.  
- Open https://studio.dincouture.pk in browser → Studio UI / tables / SQL loads.

---

## 3. ERP auto-logout – cause and fix

**Symptom:** User logs in at https://erp.dincouture.pk; after about **1 second** they are logged out again (back to login screen).

**Possible causes:**

1. **Spurious session=null from Supabase client** – e.g. token refresh or internal event fires with `session = null` shortly after sign-in; app was clearing state and showing login again.
2. **User row has `is_active = false`** – app calls `signOut()` when profile fetch returns inactive user (intended behavior).
3. **Profile fetch failed** – we do **not** sign out on profile fetch failure; we show "Loading your profile…" and retry. Only after profile load **complete** and no company do we show "Create your business" (with optional Sign out button).

**Fix applied in code:** In `SupabaseContext.tsx`, when the auth listener receives **session=null** and the event is **not** `SIGNED_OUT`, we now **verify with `getSession()`** before clearing state. If `getSession()` still returns a valid session, we keep the user logged in. This prevents a single spurious null event (e.g. token refresh race) from logging the user out.

**Deploy:** Rebuild and redeploy the ERP frontend so the new auth guard is in the live build:

```bash
# On VPS (from repo root)
cd /root/NEWPOSV3 && git pull
# Build with same env as production (see deploy.sh for VITE_ vars)
docker compose -f deploy/docker-compose.prod.yml build --no-cache erp-frontend 2>/dev/null || \
  docker build -t erp-frontend:latest -f deploy/Dockerfile . \
    --build-arg VITE_SUPABASE_URL="$(grep VITE_SUPABASE_URL .env.production | cut -d= -f2-)" \
    --build-arg VITE_SUPABASE_ANON_KEY="$(grep VITE_SUPABASE_ANON_KEY .env.production | cut -d= -f2-)"
docker compose -f deploy/docker-compose.prod.yml up -d erp-frontend 2>/dev/null || docker restart erp-frontend
```

**Verify:**  
- Log in at https://erp.dincouture.pk.  
- Session persists; dashboard remains open; no immediate logout.  
- If the user has no row in `public.users` or `is_active = false`, they will still be signed out (intended).

---

## 4. Diagnostics

| Check | Command / action |
|-------|------------------|
| **Studio reachable** | `curl -sI https://studio.dincouture.pk` → 200 or 307 |
| **Studio 502** | Run `deploy/ensure-studio-traefik-network.sh` on VPS; confirm Traefik on `supabase_default`. |
| **ERP session** | Login → wait 5s; if logged out, check browser console for `[AUTH]` and network for auth/rest 401/502. |
| **Auth health** | `curl -sI -H "apikey: YOUR_ANON_KEY" https://supabase.dincouture.pk/auth/v1/health` → 200 |

---

## 5. Files changed (this fix)

- **Studio 502:**  
  - `deploy/ensure-studio-traefik-network.sh` – new script to connect Traefik to supabase_default.  
  - `deploy/deploy.sh` – invokes the script after Studio/injector steps.
- **ERP auto-logout:**  
  - `src/app/context/SupabaseContext.tsx` – on auth state change, when session is null and event ≠ SIGNED_OUT, call `getSession()` and keep state if session still valid.
