# ERP Live Login Auth Routing Fix Report

**Date:** 2026-03-13  
**Scope:** Fix live ERP login at https://erp.dincouture.pk (localhost worked; live failed with invalid JSON and SecurityError).

---

## 1. Exact root cause

1. **Auth requests went to ERP origin instead of Supabase**  
   On the **live** ERP site, the app was using **same-origin** for the Supabase client: `VITE_SUPABASE_URL` (and `.env.production` on VPS) was set to `https://erp.dincouture.pk`. So the GoTrue client sent auth requests to `https://erp.dincouture.pk/auth/v1/...` instead of `https://supabase.dincouture.pk/auth/v1/...`.

2. **ERP origin returned non-JSON for `/auth`**  
   When the browser requested `https://erp.dincouture.pk/auth/...`, the **reverse proxy / routing** (Traefik → ERP frontend container) did not proxy that path to Kong/GoTrue. The frontend (or proxy) responded with a **redirect (e.g. 308)** or an HTML/plain body. The response body was literally `"/auth"` (or similar), so when the client tried to **parse it as JSON**, it threw:
   - `Unexpected token '/', "/auth" is not valid JSON`
   - `GoTrueClient SecurityError: The request was denied`

3. **Repo vs VPS code mismatch**  
   The **workspace** had a runtime fix in `src/lib/supabase.ts` that forces the Supabase base URL to `https://supabase.dincouture.pk` when `window.location.origin` includes `erp.dincouture.pk`. The **VPS** had an older version of the file (comment about “same-origin (erp.dincouture.pk)”) and **no** such rewrite, so the deployed build kept using the same-origin URL and hit the non-JSON response.

4. **No proxy misconfiguration**  
   Reverse proxy (Traefik) correctly sends `erp.dincouture.pk` to the ERP frontend container. The issue was **not** that `/auth` was wrongly routed on the ERP domain; it was that the **frontend** was intentionally using the ERP domain as the API base (same-origin), and that origin does not serve GoTrue JSON at `/auth/...`. The fix is to **never** use the ERP domain for the Supabase API when the app is loaded from erp.dincouture.pk; use the canonical Supabase host so auth requests go to `https://supabase.dincouture.pk/auth/v1/...` and return JSON.

---

## 2. Files / configs changed

### Repo (workspace) – already correct

- **File:** `src/lib/supabase.ts`
- **Change:** After reading `VITE_SUPABASE_URL`, a **runtime override** when the app runs on the live ERP origin:
  - If `typeof window !== 'undefined' && window.location.origin.includes('erp.dincouture.pk')` → set `supabaseUrl = 'https://supabase.dincouture.pk'`.
  - Else if `supabaseUrl.includes('erp.dincouture.pk')` → replace with `https://supabase.dincouture.pk` via regex.
- **Purpose:** Ensure the live ERP always calls `https://supabase.dincouture.pk` for auth/rest, so responses are JSON from GoTrue/Kong. No change to localhost (localhost continues to use `VITE_SUPABASE_URL` as before).

### VPS – patched then rebuilt

- **File:** `/root/NEWPOSV3/src/lib/supabase.ts`
- **Change:** Brought in line with the repo logic above (the same runtime override and correct regex). An earlier `sed` patch had produced invalid JS (single line, broken regex); it was replaced with a correct multi-line block and regex:  
  `supabaseUrl.replace(/https?:\/\/erp\.dincouture\.pk\/?/gi, "https://supabase.dincouture.pk")`.
- **Deploy:** `RUN_DEPLOY=1 bash deploy/deploy.sh` was run **without** `git reset --hard` so the VPS copy of `src/lib/supabase.ts` was used for the build. The ERP Docker image was rebuilt and the ERP container was recreated with the new image.

### Unchanged (by design)

- **Reverse proxy (Traefik):** No change. `erp.dincouture.pk` still routes to the ERP frontend.
- **CORS / Kong / GoTrue:** Already fixed earlier (see `docs/SUPABASE_AUTH_CORS_FIX_REPORT.md`). No further change.
- **`.env.production` on VPS:** Still sets `VITE_SUPABASE_URL=https://erp.dincouture.pk` (same-origin). The **runtime** override in `supabase.ts` ensures the live app ignores this for the actual base URL and uses `https://supabase.dincouture.pk`. Localhost and build-time behavior are unchanged.

---

## 3. Issue category

- **Primary:** **Frontend config / runtime URL** – live ERP was using same-origin as API base; fix is to force the canonical Supabase URL at runtime when origin is erp.dincouture.pk.
- **Contributing:** **Stale / wrong code on VPS** – deployed build was from an older `supabase.ts` without the override; fixed by correcting the file on VPS and rebuilding.
- **Not the cause:** Proxy routing for `erp.dincouture.pk` (correct); cache/service worker (no change made); backend business logic (unchanged).

---

## 4. Services / builds restarted

- **ERP frontend:** Rebuilt with `deploy/deploy.sh` (Docker build) and container recreated.
- **No restarts:** Supabase (Kong, Auth, Rest), Traefik, Nginx, or other services were not restarted for this fix.

---

## 5. Before / after verification

### Before

- **Live (https://erp.dincouture.pk):** Login failed; browser showed:
  - `Unexpected token '/', "/auth" is not valid JSON`
  - `GoTrueClient SecurityError: The request was denied`
- **Network:** Auth requests went to `https://erp.dincouture.pk/auth/...`; response was non-JSON (e.g. body `"/auth"` or redirect).
- **Localhost:** Login and session refresh worked (CORS already fixed).

### After (expected)

- **Live:** Login and session refresh should work; no “Unexpected token” or SecurityError.
- **Network:** Auth requests should go to `https://supabase.dincouture.pk/auth/v1/...` and return JSON (e.g. 200 with JSON body).
- **Localhost:** Unchanged; still uses existing `VITE_SUPABASE_URL` (e.g. https://supabase.dincouture.pk or local).

### Manual verification steps

1. Open https://erp.dincouture.pk in a clean browser (or incognito).
2. Open DevTools → Network; filter by “auth” or “token”.
3. Attempt login (email/password or magic link).
4. Confirm:
   - Requests to `https://supabase.dincouture.pk/auth/v1/...` (not erp.dincouture.pk).
   - Response status 200 and `Content-Type` JSON where applicable.
   - No console errors: “Unexpected token” or “SecurityError: The request was denied”.
5. Refresh the page and confirm session persists (no immediate redirect to login).
6. Optionally test from http://localhost (e.g. dev server) to ensure localhost auth still works.

---

## 6. Rollback notes

- **Code:** Revert `src/lib/supabase.ts` to a version **without** the `erp.dincouture.pk` → `supabase.dincouture.pk` runtime override (e.g. restore the “same-origin” comment and remove the `if (window.location.origin...)` and `else if (supabaseUrl.includes(...))` block). Then rebuild and redeploy ERP.
- **VPS:** If you need to rollback without touching repo: on VPS edit `/root/NEWPOSV3/src/lib/supabase.ts`, remove the same block, run `RUN_DEPLOY=1 bash deploy/deploy.sh` from `/root/NEWPOSV3` (without git reset so the edited file is used).
- **Config:** No proxy or Supabase env was changed for this fix; no config rollback needed.
- **CORS / Kong:** Leave as in `SUPABASE_AUTH_CORS_FIX_REPORT.md`; reverting those would break localhost again.

---

## 7. Summary

| Item | Detail |
|------|--------|
| **Root cause** | Live ERP used same-origin (`erp.dincouture.pk`) for Supabase API; that origin returned non-JSON for `/auth`, causing parse and security errors. |
| **Fix** | Runtime override in `src/lib/supabase.ts`: when origin is erp.dincouture.pk (or URL contains it), use `https://supabase.dincouture.pk` as base URL. |
| **Where** | Frontend config (runtime URL), fixed on VPS file and rebuilt. |
| **Deploy** | ERP image rebuilt; ERP container recreated. No proxy or Supabase service changes. |
| **Verification** | Login and session on https://erp.dincouture.pk; auth requests in Network tab to supabase.dincouture.pk with JSON responses; no “Unexpected token” or SecurityError. |
