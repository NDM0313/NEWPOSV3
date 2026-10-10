# Mobile APK / Capacitor — locked Supabase URL pattern

This document **locks** how the **ERP mobile app** (`erp-mobile-app/`, Capacitor Android/iOS) must resolve the Supabase HTTP base URL. Follow it on every change to auth, env, or Kong/CORS.

## Non-negotiable rules (native Capacitor)

| Rule | Detail |
|------|--------|
| **Native API base (resolved at runtime)** | On **native** (`Capacitor.isNativePlatform()`), [`resolveSupabaseApiUrl.ts`](../../erp-mobile-app/src/lib/resolveSupabaseApiUrl.ts) **always** returns **`https://api.ndmcore.com`** (ndmcore Kong / Mini PC edge). CORS must allow `capacitor://localhost` / `ionic://localhost` on that host. |
| **PWA / baked env** | `.env.production` uses **`https://api.ndmcore.com`**. Browser Origins such as **`https://erp.ndmcore.com`** must be allowed by Kong/nginx CORS. |
| **Never use `window.location.origin` on native** | Do **not** override the Supabase URL with `window.location.origin` for native apps. Capacitor WebViews commonly report **`http://localhost`**, **`capacitor://localhost`**, or **`ionic://localhost`**. Using that as the API base sends traffic to the **device**, not the server — “Cannot reach server” / network errors. |
| **Anon key** | **`import.meta.env.VITE_SUPABASE_ANON_KEY`** must match Kong’s canonical JWT (same as web). Rebuild the APK after any key rotation. |
## Allowed exceptions (non-native only)

- **Vite dev** (`import.meta.env.DEV` and browser `http://localhost` / LAN): same-origin + proxy pattern in [`erp-mobile-app/src/lib/supabase.ts`](../../erp-mobile-app/src/lib/supabase.ts) may set `supabaseUrl` to `window.location.origin` so [`erp-mobile-app/vite.config.ts`](../../erp-mobile-app/vite.config.ts) can proxy to `https://api.ndmcore.com`.
- **Mobile web / PWA** served from **`https://erp.ndmcore.com`**: same-origin override to that origin is allowed **only when not native** (browser `window`), if the ERP host proxies `/auth`, `/rest`, `/storage`.

## CORS / infrastructure

- **API edge** (`api.ndmcore.com`) must list **mobile WebView origins** (e.g. `capacitor://localhost`, `http://localhost`) so preflight succeeds.
- **Web ERP** (`erp.ndmcore.com`) should continue to allow the same Origins when used as a same-origin proxy for `/m/`.

## Build checklist (operators)

1. Confirm [`erp-mobile-app/.env.production`](../../erp-mobile-app/.env.production) has `VITE_SUPABASE_URL=https://api.ndmcore.com` + matching anon key.
2. `cd erp-mobile-app && npm run cap:sync:android:prod`
3. `cd android && ./gradlew assembleDebug` (or `gradlew.bat` on Windows) — or `assembleRelease` with signing.
4. Verify baked JS contains `api.ndmcore.com` and **no** `erp.dincouture.pk`.

## Related docs

- [`docs/infra/AUTH_PRODUCTION_LOCKED.md`](AUTH_PRODUCTION_LOCKED.md) — web + single source of truth for keys.
- [`docs/infra/AUTH_FIX_HISTORY_LOG.md`](AUTH_FIX_HISTORY_LOG.md) — recent auth bridge incidents and fixes.

## Change policy

Any PR that changes `erp-mobile-app/src/lib/supabase.ts` URL selection, mobile `.env` layout, or Kong mobile CORS must **update this file** and get explicit review for native vs web behavior.
