# Mobile APK / Capacitor — locked Supabase URL pattern

This document **locks** how the **ERP mobile app** (`erp-mobile-app/`, Capacitor Android/iOS) must resolve the Supabase HTTP base URL. Follow it on every change to auth, env, or Kong/CORS.

## Non-negotiable rules (native Capacitor)

| Rule | Detail |
|------|--------|
| **Native + production API base** | [`resolveSupabaseApiUrl.ts`](../../erp-mobile-app/src/lib/resolveSupabaseApiUrl.ts) always returns **`https://api.ndmcore.com`** on native and on production builds. Legacy hosts (`*.dincouture.pk`, `72.62.254.176`) are rewritten to the canonical URL. |
| **PWA `/m/` (browser)** | Same host: **`https://api.ndmcore.com`** (Option A). |
| **Never use `window.location.origin` on native** | Capacitor WebViews report `localhost` / `capacitor://localhost` — that must never become the API base. |
| **Anon key** | **`import.meta.env.VITE_SUPABASE_ANON_KEY`** must match Mini PC Kong’s canonical JWT. Rebuild after key rotation. |
| **Env sync must not reintroduce VPS** | [`sync-env-production-from-local.mjs`](../../erp-mobile-app/scripts/sync-env-production-from-local.mjs) and [`sync-env-from-vps.mjs`](../../erp-mobile-app/scripts/sync-env-from-vps.mjs) always write `VITE_SUPABASE_URL=https://api.ndmcore.com`. [`prepare-release-env.mjs`](../../erp-mobile-app/scripts/prepare-release-env.mjs) prefers local sync first. |
| **Host-change session purge** | [`apiHostSessionGuard.ts`](../../erp-mobile-app/src/lib/apiHostSessionGuard.ts) clears local Supabase tokens when the resolved API host changes so old VPS sessions are not reused. |

## Allowed exceptions (non-native only)

- **Vite dev** (`import.meta.env.DEV` and browser `http://localhost` / LAN): same-origin + proxy in [`erp-mobile-app/vite.config.ts`](../../erp-mobile-app/vite.config.ts) targets **`https://api.ndmcore.com`**.

## CORS / infrastructure

- Mini PC nginx/Kong for **`https://api.ndmcore.com`** must allow mobile WebView origins (`capacitor://localhost`, `ionic://localhost`, `http://localhost`).

## Build checklist (operators)

1. Confirm [`erp-mobile-app/.env.production`](../../erp-mobile-app/.env.production) has `VITE_TARGET=capacitor`, `VITE_SUPABASE_URL=https://api.ndmcore.com`, and a non-demo anon key.
2. `cd erp-mobile-app && npm run verify:mobile:env`
3. Confirm UI badge **Connected to: https://api.ndmcore.com** on login and header.
4. iOS: `npm run ios:prep:mac` then `npm run cap:ios`
5. Android: `npm run cap:sync:android:prod` then Gradle assemble.

## Related docs

- [`docs/infra/AUTH_PRODUCTION_LOCKED.md`](AUTH_PRODUCTION_LOCKED.md)
- [`docs/infra/AUTH_FIX_HISTORY_LOG.md`](AUTH_FIX_HISTORY_LOG.md)

## Change policy

Any PR that changes `resolveSupabaseApiUrl.ts`, mobile `.env` layout, env sync scripts, or Kong mobile CORS must **update this file**.
