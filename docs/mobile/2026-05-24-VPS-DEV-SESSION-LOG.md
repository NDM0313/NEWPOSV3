# VPS + Dev Session Work Log — 2026-05-24 (afternoon/evening)

**Date:** 2026-05-24  
**Repo:** NEWPOSV3  
**VPS host:** `dincouture-vps` (`ssh dincouture-vps`)  
**Related morning doc:** [2026-05-24-COMPLETED_TASKS.md](./2026-05-24-COMPLETED_TASKS.md) (contacts, leads, builds 7–9)  
**Incident handoff:** [ATTACHMENTS_AND_COUNTER_SESSION_INCIDENT_2026-05-24.md](../infra/ATTACHMENTS_AND_COUNTER_SESSION_INCIDENT_2026-05-24.md)

---

## 1. Executive summary

| Area | Before | After this session |
|------|--------|-------------------|
| **Local dev Realtime** | WebSocket failures, circuit breaker spam | `[ERP Mobile] Realtime SUBSCRIBED (dev)` confirmed |
| **Local dev Storage** | 503 / name resolution failed on sign + upload | `supabase-storage` container restarted; sign/upload work when container healthy |
| **Production PWA login** (`erp.dincouture.pk/m/`) | CORS blocked `accept-profile` → "User profile not found" | Kong CORS patched; OPTIONS returns `accept-profile` in Allow-Headers |
| **Counter PIN / auth** | refresh_token 400 loops, vault races | Session recovery, auth pause during counter lock (prior commits + this session hardening) |
| **Product images (dev)** | 503 storm, nested button warning | Signed URL cache, in-flight dedupe, upstream-unavailable gate |
| **Payment attachments** | 503 upload failures when storage down | Same VPS fix; clearer upload error message for 503 |

---

## 2. Step-by-step work (chronological)

### Step 1 — Local dev Realtime (rounds 1–3)

1. **Problem:** Browser tried direct `wss://supabase.dincouture.pk` from `localhost:5174`; Kong rejected Origin. Later, Vite proxy WS failed with 401 (Kong realtime route had ACL but no `key-auth`).
2. **Client changes:**
   - [`erp-mobile-app/src/lib/supabase.ts`](../../erp-mobile-app/src/lib/supabase.ts) — unified localhost client; circuit breaker debounce; polling fallback log
   - [`erp-mobile-app/src/lib/realtimeSubscriptions.ts`](../../erp-mobile-app/src/lib/realtimeSubscriptions.ts) — ref-counted singleton; auth gate; 5s dev defer; `SUBSCRIBED (dev)` log
   - [`erp-mobile-app/vite.config.ts`](../../erp-mobile-app/vite.config.ts) — WS proxy forwards `Origin`, `Host`, `apikey` header
   - [`erp-mobile-app/src/App.tsx`](../../erp-mobile-app/src/App.tsx) — realtime effect gated on `user?.id`
3. **VPS changes:**
   - [`deploy/fix-kong-realtime-key-auth.sh`](../../deploy/fix-kong-realtime-key-auth.sh) — add `key-auth` before ACL on `realtime-v1-ws` / `realtime-v1-rest`
   - [`deploy/diagnose-realtime-ws-vps.sh`](../../deploy/diagnose-realtime-ws-vps.sh)
4. **Result:** Console shows `[ERP Mobile] Realtime SUBSCRIBED (dev)`.

### Step 2 — Local dev Storage 503 (sign + upload)

1. **Problem:** `POST /storage/v1/object/sign/...` and payment attachment upload returned **503** with Kong error **name resolution failed**.
2. **Root cause:** `supabase-storage` Docker container was **stopped** (not wrong Kong URL). Kong `storage-v1` → `http://storage:5000/` is correct when the container runs.
3. **VPS fix:** `docker compose up -d storage` + [`deploy/fix-kong-storage-upstream.sh`](../../deploy/fix-kong-storage-upstream.sh) (ensure storage healthy on deploy).
4. **Diagnosis:** [`deploy/diagnose-storage-vps.sh`](../../deploy/diagnose-storage-vps.sh)
5. **Client hardening:**
   - [`erp-mobile-app/src/utils/storageDisplayUrl.ts`](../../erp-mobile-app/src/utils/storageDisplayUrl.ts) — negative cache, `devStorageUpstreamUnavailable` flag, in-flight sign dedupe
   - [`erp-mobile-app/src/utils/storageUploadErrors.ts`](../../erp-mobile-app/src/utils/storageUploadErrors.ts) — user message for 503 / name resolution failed
6. **Deploy hook:** [`deploy/deploy.sh`](../../deploy/deploy.sh) runs `fix-kong-storage-upstream.sh` after storage JWT step.

### Step 3 — Product images UI (dev)

1. [`erp-mobile-app/src/components/products/ProductsModule.tsx`](../../erp-mobile-app/src/components/products/ProductsModule.tsx) — image preview control changed from nested `<button>` to `<div role="button">` (fixes React DOM nesting warning).
2. Signed URL cache reduces repeated `createSignedUrl` calls on missing files.

### Step 4 — Counter PIN / session auth (ongoing from earlier today)

Key files touched in this session:

| File | Purpose |
|------|---------|
| [`authSessionRecovery.ts`](../../erp-mobile-app/src/lib/authSessionRecovery.ts) | Stale refresh detection; circuit breaker; recovery after 400/401 |
| [`supabase.ts`](../../erp-mobile-app/src/lib/supabase.ts) | `onAuthStateChange` hooks; counter vault token sync |
| [`counterUserVault.ts`](../../erp-mobile-app/src/lib/counterUserVault.ts) | Per-user refresh token storage for counter mode |
| [`counterVaultMaintenance.ts`](../../erp-mobile-app/src/lib/counterVaultMaintenance.ts) | Background vault refresh (guarded when counter locked) |
| [`pinLock.ts`](../../erp-mobile-app/src/lib/pinLock.ts) / [`counterPinUnlock.ts`](../../erp-mobile-app/src/lib/counterPinUnlock.ts) | Device PIN + counter PIN unlock flows |

See [ATTACHMENTS_AND_COUNTER_SESSION_INCIDENT_2026-05-24.md](../infra/ATTACHMENTS_AND_COUNTER_SESSION_INCIDENT_2026-05-24.md) for the three-layer login model (email → device PIN → counter PIN).

### Step 5 — Production PWA CORS (`accept-profile`)

1. **Symptom:** Login at `https://erp.dincouture.pk/m/` — email/password appears to work but UI shows **"User profile not found"**. Console: CORS blocked `accept-profile` on `GET https://supabase.dincouture.pk/rest/v1/users`.
2. **Cause:** Production mobile uses direct Supabase URL ([`resolveSupabaseApiUrl.ts`](../../erp-mobile-app/src/lib/resolveSupabaseApiUrl.ts)). Kong CORS plugins listed standard headers but **not** PostgREST profile headers (`accept-profile`, `content-profile`, `x-supabase-client-info`). ERP nginx had them; Kong did not.
3. **Fix:** [`deploy/add-kong-cors-erp-origin.sh`](../../deploy/add-kong-cors-erp-origin.sh) — merge required headers **only inside `cors` plugin blocks** (avoid corrupting other plugins).
4. **VPS verify:**
   ```bash
   curl -sI -X OPTIONS \
     -H "Origin: https://erp.dincouture.pk" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: accept-profile,authorization,apikey" \
     https://supabase.dincouture.pk/rest/v1/users
   ```
   Expect: `access-control-allow-headers: ... accept-profile,content-profile ...`

---

## 3. New / updated deploy scripts

| Script | Role |
|--------|------|
| `deploy/diagnose-realtime-ws-vps.sh` | Realtime WS upgrade diagnosis |
| `deploy/fix-kong-realtime-key-auth.sh` | key-auth on realtime routes |
| `deploy/diagnose-storage-vps.sh` | Storage upstream + bucket list test |
| `deploy/fix-kong-storage-upstream.sh` | Start storage container; probe upstream |
| `deploy/add-kong-cors-erp-origin.sh` | Origins + PostgREST CORS headers (updated) |
| `deploy/cors-proxy-supabase.md` | Proxy-level CORS reference (updated headers) |

---

## 4. Verification checklist

### Local dev (`http://localhost:5174`)

- [ ] Hard refresh after `npm run dev` restart
- [ ] Console: `[ERP Mobile] Realtime SUBSCRIBED (dev)`
- [ ] Products page: images sign (404 OK if file missing; not 503)
- [ ] Payment attachment upload succeeds

### Production PWA (`https://erp.dincouture.pk/m/`)

- [ ] Hard refresh (Ctrl+Shift+R)
- [ ] Sign in (e.g. `mm@yahoo.com`) — **no** CORS error on `/rest/v1/users`
- [ ] Profile loads; app reaches home (not "User profile not found")
- [ ] Attachment upload on payment flow

### VPS health (ops)

```bash
ssh dincouture-vps
docker ps --format '{{.Names}}\t{{.Status}}' | grep -E 'kong|storage|realtime'
bash deploy/diagnose-storage-vps.sh
bash deploy/diagnose-realtime-ws-vps.sh
```

---

## 5. Remaining tasks

1. **Storage container persistence** — If VPS reboots or compose recreates stack without `storage`, 503 returns. `deploy.sh` now runs `fix-kong-storage-upstream.sh`; consider monitoring / systemd alert if `supabase-storage` exits.
2. **PWA bundle on `/m/`** — Kong CORS fix is server-side (no redeploy required for login). Mobile **code** changes need `deploy/deploy.sh` to rebuild `/m/` when ready.
3. **Counter refresh_token 400** — May still occur on counter user switch if GoTrue token rotation desyncs; see incident doc for `REFRESH_TOKEN_REUSE_INTERVAL` option.
4. **APK build 10** — Optional; bundle auth + storage fixes for native (see morning doc build 9 notes).
5. **Product image 404 on prod** — Missing files in storage bucket (separate from 503); backfill migrations exist under `migrations/`.

---

## 6. Quick recovery commands (VPS)

```bash
# Storage down → 503 on sign/upload
cd /root/supabase/docker && docker compose up -d storage
bash /root/NEWPOSV3/deploy/fix-kong-storage-upstream.sh

# Realtime WS 401
bash /root/NEWPOSV3/deploy/fix-kong-realtime-key-auth.sh

# PWA login CORS (accept-profile)
bash /root/NEWPOSV3/deploy/add-kong-cors-erp-origin.sh
```

---

## 7. Git / deploy note

After pulling this commit on VPS:

```bash
cd /root/NEWPOSV3 && git pull
bash deploy/add-kong-cors-erp-origin.sh    # if Kong CORS not yet applied
bash deploy/fix-kong-storage-upstream.sh   # ensure storage running
# Optional full PWA rebuild:
# bash deploy/deploy.sh
```
