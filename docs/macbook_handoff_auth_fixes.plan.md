# MacBook handoff — mobile auth fixes (`erp-mobile-app`)

**Scope:** Client-only under [`erp-mobile-app/`](../erp-mobile-app/). No migrations, no `supabase.ts` URL/key changes ([`docs/infra/MOBILE_APK_LOCKED_PATTERN.md`](infra/MOBILE_APK_LOCKED_PATTERN.md)).

## Issue 1 — "Auth session missing" during business creation

**Cause:** `create_business_transaction` was invoked immediately after email OTP verification before the Supabase client always had a persisted `access_token` session.

**Fix:**

- [`erp-mobile-app/src/api/auth.ts`](../erp-mobile-app/src/api/auth.ts): `ensureAuthenticatedSession()`, updated `verifySignupEmailOtp` to establish/wait for session after OTP.
- [`erp-mobile-app/src/components/auth/CreateBusinessWizardScreen.tsx`](../erp-mobile-app/src/components/auth/CreateBusinessWizardScreen.tsx): gate `runRpcAndFinish()` on session readiness; after `hasSession` signUp path, await `ensureAuthenticatedSession`.
- [`erp-mobile-app/src/api/business.ts`](../erp-mobile-app/src/api/business.ts): require `getSession().access_token` before RPC.

## Issue 2 — Google Sign-in on Capacitor

**Cause:** OAuth `redirectTo` used web `origin` (`https://localhost` in WebView); native needs a custom URL scheme + deep link + in-app browser (`skipBrowserRedirect` + `exchangeCodeForSession`).

**Fix:**

- [`erp-mobile-app/src/lib/oauthRedirect.ts`](../erp-mobile-app/src/lib/oauthRedirect.ts): `com.dincouture.erp://oauth/callback` on native; web keeps origin/path.
- [`erp-mobile-app/src/lib/oauthCallback.ts`](../erp-mobile-app/src/lib/oauthCallback.ts): `App.addListener('appUrlOpen')`, `Browser.close()`, `supabase.auth.exchangeCodeForSession(code)`, dispatch `erp-auth-oauth-complete`.
- [`erp-mobile-app/src/api/auth.ts`](../erp-mobile-app/src/api/auth.ts): native path uses `Browser.open` + PKCE.
- [`erp-mobile-app/android/app/src/main/AndroidManifest.xml`](../erp-mobile-app/android/app/src/main/AndroidManifest.xml): `VIEW` / `BROWSABLE` intent-filter for scheme `com.dincouture.erp`, host `oauth`, pathPrefix `/callback`.
- [`erp-mobile-app/ios/App/App/Info.plist`](../erp-mobile-app/ios/App/App/Info.plist): `CFBundleURLTypes` for scheme `com.dincouture.erp` (Mac/Xcode builds).

## Supabase Dashboard — redirect URLs

**Authentication → URL configuration → Redirect URLs** — add (as applicable):

| URL | Purpose |
|-----|---------|
| `com.dincouture.erp://oauth/callback` | Native Capacitor Google OAuth return |
| `https://localhost/**` | Android WebView default origin |
| `http://localhost/**` | Alternate |
| `capacitor://localhost/**` | Some Capacitor builds |
| `http://localhost:5173/**`, `http://127.0.0.1:5173/**` | Vite dev |
| `https://erp.dincouture.pk/**` (and `/m/` if used) | Production PWA |

**Authentication → Providers → Google:** Web client ID/secret; in **Google Cloud Console**, authorized redirect URI must include Supabase’s callback (e.g. `https://<project>.supabase.co/auth/v1/callback` or self-hosted `https://supabase.dincouture.pk/auth/v1/callback`).

**Site URL:** Primary web entry (e.g. `https://erp.dincouture.pk/`).

## MacBook follow-up

```bash
cd erp-mobile-app
npm install
npx cap sync android
# or: npx cap sync ios
```

Then build from `android/` or Xcode as usual.

## Manual verification

1. `cd erp-mobile-app && npm run typecheck` passes.
2. Create business wizard: email confirm → OTP → workspace creates without "Auth session missing".
3. Immediate session after `signUp` (dev): RPC still succeeds after session poll.
4. Google on device: completes in browser → returns to app → lands on set-PIN / home (or clear error if no `users` row).
