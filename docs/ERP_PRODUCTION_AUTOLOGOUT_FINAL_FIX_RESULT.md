# ERP Production Auto-Logout – Final Fix Result

**Date:** 2026-03-19  
**Scope:** Production-only auto-logout after successful login (dashboard shows then user logged out in 1–2s). Console: GoTrueClient.js SecurityError / "request was denied".

---

## 1. Root cause

**Exact path that caused logout:**

1. User signs in → `onAuthStateChange` fires with `SIGNED_IN` and session.
2. Shortly after, GoTrueClient hits a **SecurityError** or "request was denied" (e.g. token refresh or storage read in production).
3. The client emits **session=null** again with an event that is **not** `SIGNED_OUT` (e.g. internal refresh failure).
4. In the listener we called `getSession()` to verify. If `getSession()` **returned null** (client had already cleared), we **fell through** to `setSession(session)` and `setUser(newUser)` with **null** → UI showed login again.

So the bug was: **when session=null and event !== 'SIGNED_OUT', we only avoided clearing when getSession() returned a session or threw. When getSession() returned null we still cleared.** In production, after SecurityError the client often has no session left, so getSession() returns null and we cleared = logout.

**Why localhost worked:** Localhost typically doesn’t trigger the same storage/security restrictions or CORS behavior, so the client didn’t emit a spurious session=null or getSession() still returned the session from memory.

---

## 2. Fix (code)

**SupabaseContext.tsx – auth state listener**

- When `!newUser && event !== 'SIGNED_OUT'`:
  - If `getSession()` returns a session → restore and return.
  - If `getSession()` **returns null** → **do not clear**. Set `connectionError(true)` and **return** (no fall-through to setSession(null)).
  - If `getSession()` throws → keep existing session, set connectionError, return (unchanged).
- **Only** when `event === 'SIGNED_OUT'` do we run the branch that clears session/user.

So we **never** clear session on a non-SIGNED_OUT event, even if getSession() returns null (production SecurityError path).

**SupabaseContext.tsx – attemptSessionLoad**

- In the catch block, treat **storage/security errors** like server errors: retry up to `CONNECTION_ERROR_MAX_RETRIES` before giving up, so initial load is more resilient.

**Diagnostics**

- Log when we **do** clear: `[AUTH] Logout: event= SIGNED_OUT - clearing session (only path that clears session)`.
- Log when we keep session despite null: `[AUTH] session=null but event !== SIGNED_OUT; keeping existing session, set connectionError`.

**public/sw.js**

- Cache name bumped to `erp-pos-v2` so production gets a fresh cache after deploy and doesn’t serve old auth logic.

---

## 3. Files changed

| File | Change |
|------|--------|
| **src/app/context/SupabaseContext.tsx** | Listener: when getSession() returns null (and event !== SIGNED_OUT), return without clearing; set connectionError. attemptSessionLoad: retry on storage/security error. Log logout reason and “keeping session” path. |
| **public/sw.js** | CACHE_NAME = 'erp-pos-v2' to invalidate old cache. |

---

## 4. Services / deploy

- **ERP frontend:** Rebuild and redeploy (e.g. `docker compose -f deploy/docker-compose.prod.yml build erp && up -d erp` on VPS with correct env). No Kong/Traefik/Supabase config change.

---

## 5. Verification

**Production ERP (after deploy):**

- Log in at https://erp.dincouture.pk.
- Dashboard stays open 60+ seconds; no immediate logout.
- Refresh page: user remains logged in (session from storage/memory).
- Console: no app-triggered logout after SecurityError; if session=null is emitted with event !== SIGNED_OUT, you should see "keeping existing session, set connectionError" and no redirect to login.

**Localhost:** Unchanged; no regression.

**Platform:** supabase.dincouture.pk, studio.dincouture.pk, auth/API unchanged.

---

## 6. Git

- **Commit:** (set after commit)
- **Branch:** main
