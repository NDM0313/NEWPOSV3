# Studio Blank Screen + ERP Auto-Logout Phase-2 – Result

**Date:** 2026-03-18  
**Scope:** Fix (1) Studio blank/black screen with localStorage SecurityError, (2) ERP login-then-immediate-logout with SecurityError / "request was denied" in fetch user data.

---

## 1. Root cause – Studio blank screen

**Symptom:** studio.dincouture.pk/project/default opens but main UI is blank/black; console:  
`SecurityError: Failed to read the 'localStorage' property from 'Window': Access is denied for this document`

**Cause:** The browser is denying storage access to the Studio document. Common reasons:
- **Strict privacy / tracking protection** blocking storage for the site
- **Third-party or embedded context** (e.g. if Studio were loaded in an iframe without `allow-same-origin`)
- **Site data / cookies** disabled for studio.dincouture.pk

Studio is served as the **top-level** document (Traefik → supabase-studio:3000). Studio returns `Content-Security-Policy: frame-ancestors 'none'` and `X-Frame-Options: DENY` (so we are not embedding it). The failure is the **browser** blocking localStorage for this origin or a strict context.

**Fixes applied:**
1. **Traefik:** Added middleware `studio-storage-policy` that sets `Permissions-Policy: storage-access=(self)` on Studio responses. Some browsers may allow storage when this is set. Config in `deploy/supabase-traefik.yml`; must be applied on VPS to `/etc/dokploy/traefik/dynamic/supabase.yml` and Traefik reloaded.
2. **Documentation:** Runbook updated so users allow site data for studio.dincouture.pk (Chrome: lock icon → Site settings → Cookies and site data → Allow) and try without strict extensions.

**If Studio still blank after deploy:** Allow cookies/site data for studio.dincouture.pk; try in a clean profile or another browser; disable strict privacy/analytics-blocker extensions for this site.

---

## 2. Root cause – ERP auto-logout

**Symptom:** User logs in at erp.dincouture.pk, dashboard appears, then user is logged out after ~1–2 seconds. Console:  
`[FETCH USER DATA] Transient error ... SecurityError: The request was denied`

**Cause (two parts):**
1. **Profile fetch (rest)** – The Supabase client’s `from('users').select()` can fail with a **SecurityError** or "The request was denied" (e.g. CORS, opaque response, or storage/context). That was treated as a generic transient error (single retry). After one retry we set `profileLoadComplete(true)` and did **not** sign out from this path, but the **auth** path could still clear the session (see below).
2. **Auth state listener** – When the Supabase auth client emitted **session=null** (e.g. after a failed token refresh when storage is blocked or a race), we called `getSession()` to verify. If `getSession()` **throws** (e.g. SecurityError when reading from storage), the exception was not caught: we fell through and cleared session/user, so the UI showed login again.

**Fixes applied (code):**
1. **Auth listener** – When we receive session=null and event !== SIGNED_OUT, we now wrap `getSession()` in **try/catch**. If `getSession()` throws (e.g. SecurityError), we **do not clear** session/user; we set `connectionError(true)` and return. So storage/security errors no longer force logout.
2. **fetchUserData** – **SecurityError** and "request was denied" / "access is denied" are now treated like server errors:
   - **Retry with backoff** (same as 502/5xx), up to `CONNECTION_ERROR_MAX_RETRIES`.
   - **Never sign out** on these; only set `connectionError` when retries are exhausted.
   - In the **catch** block, if the exception is a storage/security error, same retry logic and never clear session.

**Helper added:** `isStorageOrSecurityError(err)` – true when `err.name === 'SecurityError'` or message contains "SecurityError", "request was denied", or "access is denied".

---

## 3. Files changed

| File | Change |
|------|--------|
| **src/app/context/SupabaseContext.tsx** | `isStorageOrSecurityError()`; auth listener try/catch around `getSession()`; fetchUserData treats storage/security errors as retryable, never sign out; catch block retries on storage/security exception. |
| **deploy/supabase-traefik.yml** | Middleware `studio-storage-policy` (Permissions-Policy: storage-access=(self)); studio-dincouture router uses it. |
| **docs/STUDIO_BLANK_ERP_AUTOLOGOUT_PHASE2_RESULT.md** | This file. |

---

## 4. Services / deployment

- **ERP:** Rebuild and redeploy the frontend (e.g. `docker compose -f deploy/docker-compose.prod.yml build erp && up -d erp` or equivalent) so the new SupabaseContext is live.
- **Studio/Traefik:** Copy updated Traefik config to VPS and reload:
  - On VPS: copy `deploy/supabase-traefik.yml` to `/etc/dokploy/traefik/dynamic/supabase.yml` (or merge the `studio-storage-policy` middleware and studio router middlewares into the existing file), then restart Traefik or let it reload dynamic config.
- **No change** to Kong, auth, rest, or API root.

---

## 5. Verification

**Studio:**  
- Open https://studio.dincouture.pk/project/default.  
- If it still blanks: allow site data for studio.dincouture.pk; retry in clean profile / different browser.

**ERP:**  
- Log in at https://erp.dincouture.pk.  
- Dashboard should stay open; session should persist for 30–60+ seconds.  
- If profile fetch fails with SecurityError, you should see retries and then "Service temporarily unavailable" / connection error, **not** immediate logout.

**API/Auth:**  
- supabase.dincouture.pk root and auth health unchanged; previous 401/502 fixes remain.

---

## 6. Git

- **Commit:** (to be filled after commit)  
- **Branch:** main
