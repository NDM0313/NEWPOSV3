# Login 401 Global Fix – Result

**Master runbook (502/401/office/ghar):** **`docs/MASTER_AUTH_AND_KONG_RUNBOOK.md`**

**Date:** 2026-03-18  
**Scope:** Restore working login for all valid accounts (localhost + production) after company reset.

---

## Root cause

1. **Kong auth route had no key-auth plugin**  
   The self-hosted `kong.yml` (at `/root/supabase/docker/volumes/api/kong.yml` on the VPS) had **ACL** on `/auth/v1/` and `/rest/v1/` but **no key-auth** on the auth route. The ACL plugin allows consumers in groups `anon` or `admin`; without key-auth, the request never gets a consumer, so Kong returned **401 Unauthorized** before the request reached GoTrue.

2. **Health and token both failed**  
   Because the same Kong config applied to `/auth/v1/health` and `/auth/v1/token`, both returned 401 with the anon key, so the failure was at Kong, not at GoTrue or password.

---

## What was changed

### On VPS (manual one-time)

1. **`/root/supabase/docker/volumes/api/kong.yml`**  
   - **auth-v1:** Inserted **key-auth** (and `config: hide_credentials: false`) before the existing `cors` plugin for the service whose path is `/auth/v1/` (around line 78).  
   - **rest-v1:** Same key-auth block inserted before `cors` for the service whose path is `/rest/v1/` (around line 99).  
   - So: `plugins:` → `key-auth` → `cors` → `acl` for both auth-v1 and rest-v1.

2. **Kong recreated**  
   - `cd /root/supabase/docker && docker compose up -d kong --force-recreate`  
   - Kong’s entrypoint expands `$SUPABASE_ANON_KEY` from the container env into the mounted template; the anon key in `.env` is used and key-auth now accepts it.

### In repo (scripts/docs)

- **`deploy/diagnose-auth-401.sh`** – Diagnostic script: env consistency, Kong key, GoTrue health, auth health with apikey, auth.users count, token test.
- **`deploy/verify-login-401-fix.sh`** – Verification: health + admin + ndm313 logins; passes if health is 200 and at least one login succeeds.
- **`deploy/add-kong-key-auth-to-auth-rest.py`** – Optional script to add key-auth to auth-v1 and rest-v1 in kong.yml (for use on VPS if kong.yml is reset).
- **`docs/LOGIN_401_RESULT.md`** – This file.

---

## What was restarted

- **Kong:** `docker compose up -d kong --force-recreate` (after editing kong.yml).
- Auth and Rest were not restarted for this fix; they were restarted earlier by `deploy/login-401-global-fix.sh` (password reset and key sync).

---

## What was verified

- **Health with apikey:** `GET https://supabase.dincouture.pk/auth/v1/health` with header `apikey: <ANON_KEY>` → **200 OK**.
- **Token (ndm313@yahoo.com):** `POST .../auth/v1/token?grant_type=password` with same apikey and body `{"email":"ndm313@yahoo.com","password":"123456"}` → **200** and `access_token` in response.
- **admin@dincouture.pk:** Can still return `invalid_credentials` if the password in the DB does not match; run the password reset SQL (see below) if needed.

---

## Credentials (reference)

- **admin@dincouture.pk** → `AdminDincouture2026` (set via `scripts/vps-reset-passwords-now.sql` or Phase 6 of `deploy/login-401-global-fix.sh`).
- **ndm313@yahoo.com** / **ndm313@live.com** → `123456`.
- **demo@dincollection.com** → `demo123`.

---

## Re-running diagnostics

- **On VPS:**  
  `cd /root/NEWPOSV3 && bash deploy/diagnose-auth-401.sh`  
  Then:  
  `bash deploy/verify-login-401-fix.sh`

- **If health is 401 again:**  
  - Ensure kong.yml has **key-auth** on the auth-v1 (and optionally rest-v1) service, then run:  
    `cd /root/supabase/docker && docker compose up -d kong --force-recreate`

- **If admin login fails with invalid_credentials:**  
  Run password reset, e.g. pipe `scripts/vps-reset-passwords-now.sql` into `docker exec -i supabase-db psql -U postgres -d postgres` on the VPS.

---

## Key sync (if keys get out of sync)

Run on VPS:

```bash
cd /root/NEWPOSV3 && bash deploy/login-401-global-fix.sh
```

This regenerates anon/service keys from `JWT_SECRET` in `/root/supabase/docker/.env`, updates that .env and ERP `.env.production`, recreates Kong, restarts Auth/Rest, and resets auth.users passwords.

---

## Summary

| Item | Result |
|------|--------|
| Root cause | Kong auth (and rest) route had ACL but no key-auth → 401 before GoTrue |
| Fix | Added key-auth to auth-v1 and rest-v1 in kong.yml; recreated Kong |
| Health with apikey | 200 OK |
| Login (ndm313@yahoo.com) | OK |
| Login (admin) | OK after password reset if needed |
| Git | Scripts and this doc committed and pushed (see Phase 6) |
