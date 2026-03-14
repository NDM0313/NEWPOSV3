# ERP Post-Login Business Profile Fix Report

**Date:** 2026-03-13  
**Scope:** Fix live ERP showing "You're signed in but don't have a business yet" incorrectly after successful login (profile/business exists but app showed no-business state).

---

## 1. Exact root cause

**Premature "no business" UI and no retry on transient profile fetch failure.**

1. **Timing:** After sign-in, the app set `loading = false` as soon as `getSession()` resolved, then called `fetchUserData(session.user.id)` asynchronously. The Dashboard renders when `user` is set and `loading` is false; at that moment `companyId` is still null (profile fetch not yet completed or failed). The Dashboard treated **any** `!companyId` as "no business" and showed the "Create your business" CTA immediately.

2. **No distinction between "still loading" and "definitively no profile":** There was no signal that the profile fetch had *finished*. So a transient failure (e.g. network, CORS, or SecurityError from an opaque response) left `companyId` null and the UI showed "no business" even when the user had a valid row in `public.users`.

3. **Single attempt, no retry:** If the first `users` table request failed for a transient reason, the code logged `[FETCH USER DATA ERROR]` and returned without retrying, so the user stayed in the false "no business" state.

**Verified on VPS:** RLS on `public.users` already allows the authenticated user to read their row via `users_read_own_row` (`id = auth.uid() OR auth_user_id = auth.uid()`). The signed-in user (e.g. ndm313@yahoo.com) has a row in `public.users` with `company_id` set. So the issue was **not** missing DB mapping or RLS; it was **frontend bootstrap logic** (no "profile load complete" state and no retry).

**SecurityError / "Host validation failed":** These console messages can come from Supabase client or other scripts when a request is blocked or returns an opaque response (e.g. CORS). They are consistent with a single failed profile fetch being treated as "no business" and are addressed by the same fix (retry + only show "no business" after profile load is complete).

---

## 2. Failure category

| Category        | Result |
|-----------------|--------|
| **DB mapping**  | OK – user exists in `public.users` with `auth_user_id` / `id` and `company_id`. |
| **RLS**        | OK – `users_read_own_row` allows SELECT by `id` or `auth_user_id` = `auth.uid()`. |
| **Frontend**   | **Fixed** – profile load state + retry so "no business" only shows when profile load has completed and there is no company. |

---

## 3. Files changed

### `src/app/context/SupabaseContext.tsx`

- **`profileLoadComplete` state:** New boolean, initially `false`. Set `true` when the first profile fetch for the current user has finished (success, no row, permission error, or after retry).
- **Context API:** Added `profileLoadComplete` to the context type, value, default context, and dependency array.
- **Reset on sign-out:** When `session` becomes null, set `profileLoadComplete` to `false`.
- **fetchUserData:**
  - **Retry:** On non–permission-denied error (e.g. network/CORS), retry once after 1.5s before treating as failure. Same for exceptions in the `catch` block.
  - **Settle state:** Set `profileLoadComplete = true` when: we have a definitive result (data set, no data, permission error, or after retry failure). When using cached data (already fetched), set `profileLoadComplete = true` immediately.
- **Sign-out:** Clear `profileLoadComplete` along with other user state.

### `src/app/components/dashboard/Dashboard.tsx`

- **useSupabase:** Destructure `profileLoadComplete`.
- **No-company branch:** If `!companyId`:
  - If **not** `profileLoadComplete`: show a loading state ("Loading your profile…" with spinner) instead of "Create your business".
  - If `profileLoadComplete`: show the existing "Create your business" CTA (user really has no business).
- Comment updated to describe that "Create your business" is shown only after profile load is complete.

---

## 4. Before / after behavior

### Before

- User signs in → session and user set, `loading = false`, `fetchUserData` started.
- Dashboard renders with `user` set and `companyId` null → immediately shows "Create your business."
- If the profile request failed once (e.g. transient/CORS), user stayed on that screen with `[FETCH USER DATA ERROR]` and SecurityError in console.

### After

- User signs in → same, but Dashboard sees `profileLoadComplete === false` while profile is loading → shows "Loading your profile…" with spinner.
- If the first profile request fails with a non–permission error → one retry after 1.5s. On success → `companyId` and role set, `profileLoadComplete = true` → Dashboard shows normal dashboard.
- Only when profile load has completed **and** there is no company do we show "Create your business."

---

## 5. Live verification steps

1. Open https://erp.dincouture.pk and sign in with an account that has a row in `public.users` with a `company_id`.
2. Confirm either:
   - Brief "Loading your profile…" then dashboard with data, or
   - Direct load into dashboard (if profile loads before first paint).
3. Refresh the page and confirm session and business still load (no false "no business").
4. Optionally sign in with an account that has **no** row in `public.users` (or no `company_id`) and confirm "Create your business" appears only after the loading state.

---

## 6. Rollback notes

- **SupabaseContext:** Revert the additions of `profileLoadComplete`, the retry in `fetchUserData`, and the reset on sign-out. Remove `profileLoadComplete` from the context value and default.
- **Dashboard:** Revert the `profileLoadComplete` check and loading UI so that `!companyId` again shows "Create your business" immediately (previous behavior).
- No DB or RLS changes were made; no rollback there.

---

## 7. Summary

| Item            | Detail |
|-----------------|--------|
| **Root cause**  | No "profile load complete" signal and no retry; Dashboard showed "no business" whenever `companyId` was null, including while loading or after a single transient fetch failure. |
| **Fix**         | Added `profileLoadComplete`, set it when profile fetch settles; retry profile fetch once on non–permission errors; Dashboard shows "no business" only when `profileLoadComplete` is true and `companyId` is null. |
| **Where**       | Frontend bootstrap (SupabaseContext + Dashboard). DB/RLS unchanged and already correct. |
| **SecurityError / Host validation** | Treated as likely consequences of a failed profile request; same fix (retry + profile load state) avoids incorrectly showing "no business" when the profile request fails once. |
