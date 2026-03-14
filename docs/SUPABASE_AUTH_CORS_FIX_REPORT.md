# Supabase Auth CORS Fix Report

**Date:** 2026-03-13  
**Scope:** Self-hosted Supabase auth endpoint CORS blocking login/session refresh from localhost and ERP.

---

## 1. Exact root cause

1. **Kong was crash-looping**  
   The Kong declarative config at `/root/supabase/docker/volumes/api/kong.yml` had **invalid YAML**. A custom CORS block had been added to multiple services with **wrong indentation**: `config:` (and its children `origins:`, `credentials: true`, etc.) were at the same level as `plugins:` instead of under the `- name: cors` plugin. Kong reported:  
   `failed parsing declarative configuration: 161:27: did not find expected key`  
   So Kong never came up and all requests to `https://supabase.dincouture.pk` returned **502**.

2. **Missing CORS for localhost**  
   Even when Kong was fixed, the **custom** CORS config only allowed `https://erp.dincouture.pk`. Requests from `http://localhost:5173` (dev) did not get `Access-Control-Allow-Origin`, so the browser blocked them and session refresh failed.

3. **GoTrue redirect allow list**  
   `ADDITIONAL_REDIRECT_URLS` in `/root/supabase/docker/.env` did not include `http://localhost:5173`, so GoTrue’s own CORS/redirect logic did not treat localhost as allowed. This was fixed so both Kong (default CORS) and GoTrue are aligned.

---

## 2. Files / configs changed

### VPS – Kong config

- **File:** `/root/supabase/docker/volumes/api/kong.yml`
- **Change:** Removed the **broken custom CORS config** (the misplaced `config:` block and its 4 lines: `config:`, `origins:`, `- "https://erp.dincouture.pk"`, `credentials: true`) from every service that had it. The **plugin list** was left as `- name: cors` only, so Kong uses its **default CORS plugin** (which sends `Access-Control-Allow-Origin: *` and handles OPTIONS). No other Kong routes or plugins were changed.
- **Method:** One-time Python script on the VPS that, for each occurrence of the 4-line CORS block immediately after `- name: cors`, skipped those 4 lines so they were not written to the new file.

### VPS – GoTrue env

- **File:** `/root/supabase/docker/.env`
- **Change:** Extended `ADDITIONAL_REDIRECT_URLS` with:
  - `http://localhost:5173`
  - `http://localhost:5173/`
- **Line (conceptually):**  
  `ADDITIONAL_REDIRECT_URLS=https://erp.dincouture.pk,https://erp.dincouture.pk/,https://erp.dincouture.pk/**,http://localhost:5173,http://localhost:5173/`

### Repo + VPS – Traefik (CORS middleware)

- **Repo file:** `deploy/supabase-traefik.yml`
- **VPS file:** `/etc/dokploy/traefik/dynamic/supabase.yml` (updated from repo file)
- **Change:** Added a **headers middleware** `supabase-cors` and attached it to the `supabase-dincouture` router so that responses for `supabase.dincouture.pk` include:
  - `accessControlAllowOriginList`: `http://localhost:5173`, `https://erp.dincouture.pk`
  - `accessControlAllowMethods`: GET, POST, OPTIONS, PUT, PATCH, DELETE
  - `accessControlAllowHeaders`: `*`
  - `accessControlAllowCredentials`: true
  - `accessControlMaxAge`: 86400
  - `addVaryHeader`: true  
  This guarantees CORS headers even if Kong’s behaviour changes.

### Frontend / env

- **No code or env changes.**  
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are unchanged. The app already points to `https://supabase.dincouture.pk` (and `src/lib/supabase.ts` rewrites `erp.dincouture.pk` to `supabase.dincouture.pk`). No runtime URL override was added or removed.

---

## 3. Domains / origins allowed

| Origin                     | Where allowed |
|----------------------------|----------------|
| `http://localhost:5173`    | GoTrue `ADDITIONAL_REDIRECT_URLS`; Traefik `supabase-cors` middleware |
| `https://erp.dincouture.pk`| GoTrue (already in `SITE_URL` / redirects); Traefik `supabase-cors` |
| Kong default CORS          | Sends `Access-Control-Allow-Origin: *` (so any origin gets a CORS response from Kong) |

---

## 4. Services restarted

- **Kong:** `docker compose restart kong` (in `/root/supabase/docker`).  
  Kong started successfully and stayed healthy after the config fix.
- **Auth (GoTrue):** `docker compose restart auth` (same directory).  
  Picks up the new `ADDITIONAL_REDIRECT_URLS`.
- **Traefik:** `docker restart <traefik-container-id>` after updating `/etc/dokploy/traefik/dynamic/supabase.yml`.  
  Loads the new middleware and router config.

---

## 5. Before / after verification

### Before

- `curl -sI -X OPTIONS -H "Origin: http://localhost:5173" ... https://supabase.dincouture.pk/auth/v1/token` → **502** (Kong down).
- Browser: “No 'Access-Control-Allow-Origin' header” and session refresh failing from localhost and (when Kong was down) from ERP.

### After

- OPTIONS to `https://supabase.dincouture.pk/auth/v1/token` with `Origin: http://localhost:5173` → **HTTP/2 200** with:
  - `access-control-allow-origin: *` (from Kong)
  - `access-control-allow-methods: GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS,...`
- Kong: **Up (healthy)**.
- Traefik applies `supabase-cors` for `supabase.dincouture.pk`, so responses also get the configured CORS headers (including explicit origins when used).

### What to test manually

1. **Local dev (localhost:5173):** Login, session recovery, refresh token call; no CORS errors in console.
2. **Production (https://erp.dincouture.pk):** Login page, session persistence, refresh token; no “blocked by CORS” or “AuthRetryableFetchError: Failed to fetch”.
3. Browser DevTools → Network: OPTIONS to `/auth/v1/token?grant_type=refresh_token` should return **200** and include `Access-Control-Allow-Origin` (either `*` or the request origin).

---

## 6. Rollback notes

1. **Kong**  
   Restore the previous `kong.yml` from backup if needed:  
   `cp /root/supabase/docker/volumes/api/kong.yml.bak /root/supabase/docker/volumes/api/kong.yml`  
   Then fix the YAML (indent the CORS `config` under `- name: cors`) or remove the custom CORS block again, and restart Kong.  
   Do **not** restore the broken version without fixing it, or Kong will re-enter a restart loop.

2. **GoTrue**  
   In `/root/supabase/docker/.env`, remove `,http://localhost:5173,http://localhost:5173/` from `ADDITIONAL_REDIRECT_URLS`, then:  
   `docker compose restart auth`

3. **Traefik**  
   In `/etc/dokploy/traefik/dynamic/supabase.yml` (or the repo’s `deploy/supabase-traefik.yml`):  
   - Remove the `middlewares:` section and the `supabase-cors` middleware.  
   - Remove `middlewares: - supabase-cors` from the `supabase-dincouture` router.  
   Then restart Traefik.

4. **Frontend**  
   No changes were made; no rollback needed.

---

## 7. Summary

| Item              | Detail |
|-------------------|--------|
| **Root cause**    | Kong crash due to invalid CORS YAML; localhost not in GoTrue redirect list; no CORS headers for localhost/ERP. |
| **Configs changed** | `kong.yml` (VPS), `.env` (VPS), `deploy/supabase-traefik.yml` + VPS `supabase.yml`. |
| **Origins allowed** | `http://localhost:5173`, `https://erp.dincouture.pk` (and Kong default `*`). |
| **Services restarted** | Kong, auth (GoTrue), Traefik. |
| **Result**         | Kong healthy; OPTIONS/preflight to `/auth/v1/token` returns 200 with CORS headers; login and session refresh can work from localhost and ERP. |
