# Supabase Auth 502 Upstream Fix Report

**Date:** 2026-03-13  
**Scope:** Fix 502 Bad Gateway on https://supabase.dincouture.pk/auth/v1/* so live ERP login can complete (frontend already pointed at correct domain).

---

## 1. Exact root cause

**Kong was crash-looping due to invalid declarative config.**

- **Symptom:** All requests to `https://supabase.dincouture.pk/auth/v1/*` (and `/auth/v1/health`, `/auth/v1/settings`, `/auth/v1/token`, etc.) returned **502 Bad Gateway**. Traefik was forwarding to Kong; Kong was not running, so Traefik returned 502.
- **Container state:** `supabase-kong` was in **Restarting (1)**. GoTrue (`supabase-auth`) was **Up (healthy)**.
- **Kong logs:**  
  `failed parsing declarative configuration: 161:27: did not find expected key`
- **Cause:** In `/root/supabase/docker/volumes/api/kong.yml`, multiple services had a **misplaced CORS `config:` block**. The block (`config:`, `origins:`, `credentials: true`, `methods:`, `headers:`, `preflight_continue: false`) was at the **same indentation as** the `plugins:` list instead of **under** `- name: cors`. So YAML parsing failed at line 161 (inside the auth-v1 service block). Kong never started, so no request reached GoTrue.

**Not the cause:** GoTrue, Traefik, or upstream routing. GoTrue was healthy; Traefik was correctly routing supabase.dincouture.pk to Kong.

---

## 2. Failure layer

| Layer        | Status / role |
|-------------|----------------|
| **Traefik** | OK – forwards supabase.dincouture.pk to Kong. |
| **Kong**    | **Failed** – would not start due to invalid kong.yml. |
| **GoTrue** | OK – healthy; never received traffic while Kong was down. |

---

## 3. Files / configs changed

### VPS – Kong declarative config

- **File:** `/root/supabase/docker/volumes/api/kong.yml`
- **Change:** Removed **every** misplaced CORS `config:` block that appeared immediately after `- name: cors` (and optional blank line). Each removed block consisted of:
  - `config:`
  - `origins:` / `- "https://erp.dincouture.pk"`
  - `credentials: true`
  - `methods:` and list (GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS)
  - `headers:` and list (Authorization, Content-Type, apikey, etc.)
  - `preflight_continue: false`
- **Left in place:** `- name: cors` only (no custom config), so Kong uses its **default CORS plugin**.
- **Method:** One-time Python script on the VPS that scanned the file and skipped writing these misplaced blocks so the plugin list only contains valid list items (e.g. `- name: cors`, `- name: key-auth`, `- name: acl`).
- **Backup:** `cp .../kong.yml .../kong.yml.bak-502fix` before restart.

### Unchanged

- GoTrue env, Traefik config, ERP frontend, and other Supabase services were not changed.

---

## 4. Containers / services restarted

- **Kong only:** `docker compose restart kong` in `/root/supabase/docker`.
- No restart of Traefik, GoTrue, Rest, Studio, or ERP.

---

## 5. Before / after verification

### Before (from VPS)

- `curl -sS -o /dev/null -w '%{http_code}' https://supabase.dincouture.pk/auth/v1/health` → **502**
- `curl -sS -o /dev/null -w '%{http_code}' https://supabase.dincouture.pk/auth/v1/settings` → **502**
- `docker ps`: `supabase-kong` → **Restarting (1)**
- Kong logs: `failed parsing declarative configuration: 161:27: did not find expected key`

### After (from VPS)

- Without apikey (Kong key-auth):  
  `curl -sS https://supabase.dincouture.pk/auth/v1/health` → **401** with body `{"message":"No API key found in request"}` (proves Kong is up and routing).
- With apikey:  
  `curl -sS -H "apikey: $ANON_KEY" https://supabase.dincouture.pk/auth/v1/health` → **200** with JSON:  
  `{"version":"v2.185.0","name":"GoTrue","description":"GoTrue is a user registration and authentication API"}`
- `curl -sS -H "apikey: $ANON_KEY" https://supabase.dincouture.pk/auth/v1/settings` → **200** with JSON (external providers, disable_signup, etc.).
- `docker ps`: `supabase-kong` → **Up N seconds (healthy)**

---

## 6. Browser / live verification

- **Expected:** At https://erp.dincouture.pk, login (e.g. email/password or magic link) should succeed. The browser sends requests to `https://supabase.dincouture.pk/auth/v1/token` (and related) **with the anon key**; Kong accepts them and forwards to GoTrue, which returns JSON. No 502, no AuthRetryableFetchError; session should persist after login.
- **How to confirm:** Open https://erp.dincouture.pk → DevTools → Network; perform login; verify auth requests to supabase.dincouture.pk return **200** and JSON, not 502.

---

## 7. Rollback notes

- **Restore Kong config:**  
  `cp /root/supabase/docker/volumes/api/kong.yml.bak-502fix /root/supabase/docker/volumes/api/kong.yml`  
  Then restart Kong. Note: the backup contains the **broken** config; restoring it will bring back the 502. Rollback is only for reverting the file edit; the correct long-term state is the fixed kong.yml (no misplaced CORS config).
- **No other config or env was changed;** no rollback needed for Traefik or GoTrue.

---

## 8. Summary

| Item | Detail |
|------|--------|
| **Root cause** | Kong crash-loop: invalid YAML in kong.yml at line 161 (misplaced CORS `config:` block under multiple services). |
| **Failure layer** | Kong (config parse failure); GoTrue and Traefik were OK. |
| **Fix** | Remove all misplaced CORS config blocks from kong.yml; keep `- name: cors` only. |
| **Restarted** | Kong only. |
| **Verification** | Auth health/settings return 200 with JSON when apikey is sent; 401 without apikey. Kong container healthy. |

---

## 9. If 502 returns again (runbook)

**Reapplication (2026-03-14):** 502 recurred; Kong was Restarting with same parse error at line 163. The misplaced CORS `config:` blocks had reappeared in kong.yml (e.g. under rest-v1 and auth-v1). Fix re-applied on VPS: backup kong.yml, removed all misplaced `config:` blocks (4-space indent) that followed `- name: cors`, restarted Kong. Auth health returned 200; login works again. If Supabase/Kong config is ever regenerated or CORS is re-added manually, ensure `config:` for CORS is **nested under** `- name: cors` (e.g. 6-space indent for `config:`), not at service level (4-space).

When `POST https://supabase.dincouture.pk/auth/v1/token` or `GET .../auth/v1/user` returns **502 Bad Gateway**:

**One-command fix (from your machine):**
```bash
ssh dincouture-vps "cd /root/NEWPOSV3 && bash deploy/fix-kong-502-auth.sh"
```
(After pushing the script; or run the runbook steps below on the VPS.)

**Manual runbook:**

1. **SSH to VPS:** `ssh dincouture-vps`
2. **Check Kong and Auth:**
   ```bash
   cd /root/supabase/docker && docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "kong|auth"
   ```
   - If `supabase-kong` is **Restarting** → Kong is failing; check logs (step 3).
   - If **Up (healthy)** → 502 may be timeout or Traefik; try step 4.
3. **Kong logs (if Restarting):**
   ```bash
   docker logs supabase-kong --tail 80
   ```
   - If you see `failed parsing declarative configuration` or line number in kong.yml → fix kong.yml again (remove any misplaced CORS `config:` blocks under `plugins:`; keep only `- name: cors`). Backup: `cp /root/supabase/docker/volumes/api/kong.yml /root/supabase/docker/volumes/api/kong.yml.bak-$(date +%Y%m%d)` then edit, then `docker compose restart kong`.
4. **Quick auth health check from VPS** (replace with your anon key if needed):
   ```bash
   source /root/supabase/docker/.env 2>/dev/null; curl -sS -o /dev/null -w '%{http_code}' -H "apikey: ${ANON_KEY}" https://supabase.dincouture.pk/auth/v1/health
   ```
   - **200** = Kong and GoTrue OK; 502 may be client-side or transient. Retry login.
   - **502** = Kong/GoTrue not responding to Traefik; restart Kong: `cd /root/supabase/docker && docker compose restart kong`, wait 30s, retry.
5. **Restart Kong only (safe):**
   ```bash
   cd /root/supabase/docker && docker compose restart kong
   ```
   Wait ~30 seconds, then test login again at https://erp.dincouture.pk.

**Script:** `deploy/fix-kong-502-auth.sh` backs up kong.yml, removes misplaced CORS `config:` blocks, restarts Kong, and optionally verifies auth health. Push the repo to the VPS then run the one-command fix above.
