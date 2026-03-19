# Login 502 AuthRetryableFetchError – Fix Result (Phase 2)

**Date:** 2026-03-18  
**Scope:** Fix 502 Bad Gateway / AuthRetryableFetchError after the 401 fix. Restore working login on localhost and production.

---

## Root cause

1. **Kong crash-loop (502)**  
   Kong was failing to parse `kong.yml` with:
   - `plugin 'analytics-v1-all' not enabled`
   - Cause: **Routes** (`functions-v1-all`, `analytics-v1-all`) were wrongly nested under **plugins** in the storage/functions/analytics section, so Kong treated them as plugin names.

2. **404 after first fix**  
   After fixing the analytics block, Kong started but returned **404 "no Route matched"** for `/auth/v1/` because the **auth block** was also malformed: the secure route `auth-v1-all` and other route definitions were listed under **plugins** of a single merged service instead of being proper services with their own `routes:` and `plugins:`.

---

## What was changed

### On VPS (automated)

1. **`/root/supabase/docker/volumes/api/kong.yml`**
   - **Storage/functions/analytics:** Replaced the malformed block (routes under plugins) with correct separate services: `storage-v1`, `functions-v1`, `analytics-v1`, each with proper `routes:` and `plugins:` (script: `deploy/fix-kong-analytics-plugin-error.py`).
   - **Auth block:** Replaced the merged auth section with correct separate services: `auth-v1-open` (verify), `auth-v1-open-callback`, `auth-v1-open-authorize`, and **auth-v1** (secure) with `url: http://auth:9999/`, route `auth-v1-all` for `/auth/v1/`, and plugins key-auth, cors, acl (script: `deploy/fix-kong-auth-routes.py`).

2. **Kong**
   - `cd /root/supabase/docker && docker compose up -d kong --force-recreate` (after each kong.yml fix).

### In repo

- **`deploy/fix-kong-analytics-plugin-error.py`** – Fixes storage/functions/analytics block (plugin 'analytics-v1-all' not enabled).
- **`deploy/fix-kong-auth-routes.py`** – Fixes auth block (404 no Route matched for /auth/v1/).
- **`deploy/diagnose-auth-full.sh`** – Combined diagnostic: env, Kong, auth/rest upstream, health, REST, token, auth.users, frontend env; distinguishes 401 vs 502 vs invalid_credentials.

---

## What was restarted

- **Kong:** `docker compose up -d kong --force-recreate` (twice: after analytics fix, then after auth fix).

---

## What was verified

- **Health with apikey:** `GET https://supabase.dincouture.pk/auth/v1/health` → **200 OK**
- **Token (ndm313@yahoo.com):** `POST .../auth/v1/token?grant_type=password` → **200** and `access_token`
- **admin@dincouture.pk:** Can still return `invalid_credentials` if DB password not set; run `scripts/vps-reset-passwords-now.sql` on VPS if needed.
- **Kong:** Container status **Up (healthy)** (no longer Restarting).

---

## Error quick reference

| Symptom | Likely cause | Action |
|--------|---------------|--------|
| 401 Unauthorized | Kong key-auth/ACL or wrong anon key | Sync anon key; ensure auth-v1 has key-auth in kong.yml |
| 502 Bad Gateway / AuthRetryableFetchError | Kong down or kong.yml parse error | Check `docker logs supabase-kong`; run fix scripts if config malformed |
| 404 no Route matched | Auth route not defined (auth-v1-all under plugins) | Run `fix-kong-auth-routes.py` and recreate Kong |
| plugin 'X' not enabled | Route name under plugins in kong.yml | Fix malformed block (e.g. `fix-kong-analytics-plugin-error.py`) |
| invalid_credentials | User/password in DB | Run password reset SQL |

---

## Re-run diagnostics

- **Full diagnostic (VPS):**  
  `cd /root/NEWPOSV3 && bash deploy/diagnose-auth-full.sh`
- **Quick verify:**  
  `bash deploy/verify-login-401-fix.sh`
- **If Kong restarts again:**  
  `docker logs supabase-kong --tail 50` then apply the appropriate fix script and `docker compose up -d kong --force-recreate`.

---

## Office: apply 502 fix (VPS)

Agar login pe **502** ya **AuthRetryableFetchError** aaye, VPS par ye steps chalao:

1. **Diagnostic:**  
   `ssh dincouture-vps "cd /root/NEWPOSV3 && bash deploy/diagnose-auth-full.sh"`
2. **502 / Kong Restarting:** Kong logs dekho; `fix-kong-analytics-plugin-error.py` ya kong.yml CORS fix; phir `docker compose up -d kong --force-recreate`.
3. **404 no Route matched:** `fix-kong-auth-routes.py` chalao, phir Kong recreate.
4. **Verify:** `diagnose-auth-full.sh` dubara; health 200, token OK.

(Full steps: `docs/LOGIN_502_RESULT.md`.)

---

## Git

- **Commits:** `7a4b9b8` (fix-kong-analytics), `7ac629e` (fix-kong-auth-routes), `31c593b` (diagnose-auth-full + LOGIN_502_RESULT).
- All fixes and scripts pushed to main.
