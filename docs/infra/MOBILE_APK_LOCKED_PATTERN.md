# Mobile APK / Capacitor — locked Supabase URL pattern

This document **locks** how the **ERP mobile app** (`erp-mobile-app/`, Capacitor Android/iOS) must resolve the Supabase HTTP base URL. Follow it on every change to auth, env, or Kong/CORS.

## Non-negotiable rules (native Capacitor)

| Rule | Detail |
|------|--------|
| **Native API base (resolved at runtime)** | On **native** (`Capacitor.isNativePlatform()`), [`resolveSupabaseApiUrl.ts`](../../erp-mobile-app/src/lib/resolveSupabaseApiUrl.ts) **always** returns **`https://erp.dincouture.pk`** (ERP nginx → Kong). This is required so `Origin: capacitor://localhost` gets `Access-Control-Allow-Origin` from [`deploy/nginx.conf`](../../deploy/nginx.conf). Do not rewrite native to direct `supabase.dincouture.pk` (Kong does not echo Capacitor origins on auth). |
| **PWA `/m/` (browser)** | Baked env may use **`https://supabase.dincouture.pk`**; browser `Origin` is **`https://erp.dincouture.pk`**, which Kong allows. PWA and native intentionally differ. |
| **Never use `window.location.origin` on native** | Do **not** override the Supabase URL with `window.location.origin` for native apps. Capacitor WebViews commonly report **`http://localhost`**, **`capacitor://localhost`**, or **`ionic://localhost`**. Using that as the API base sends traffic to the **device**, not the VPS — “Cannot reach server” / network errors. |
| **Anon key** | **`import.meta.env.VITE_SUPABASE_ANON_KEY`** must match Kong’s canonical JWT (same as web). Sync from [`deploy/write-erp-env-from-supabase-docker-env.sh`](../../deploy/write-erp-env-from-supabase-docker-env.sh) / root `.env.production`; rebuild the APK after any key rotation. |

## Allowed exceptions (non-native only)

- **Vite dev** (`import.meta.env.DEV` and browser `http://localhost` / LAN): same-origin + proxy pattern in [`erp-mobile-app/src/lib/supabase.ts`](../../erp-mobile-app/src/lib/supabase.ts) may set `supabaseUrl` to `window.location.origin` so [`erp-mobile-app/vite.config.ts`](../../erp-mobile-app/vite.config.ts) can proxy to Supabase.
- **Mobile web / PWA** served from **`https://erp.dincouture.pk`**: same-origin override to that origin is allowed **only when not native** (browser `window`).

## CORS / infrastructure

- **ERP Nginx** ([`deploy/nginx.conf`](../../deploy/nginx.conf)) already allows `capacitor://localhost` and `ionic://localhost` in the `$cors_origin` map for same-origin ERP traffic.
- **Kong** (`kong.yml`): [`deploy/add-kong-cors-erp-origin.sh`](../../deploy/add-kong-cors-erp-origin.sh) must list **mobile WebView origins** (e.g. `capacitor://localhost`, `http://localhost`) so preflight succeeds when the app calls **`https://erp.dincouture.pk`** with those `Origin` headers. Run that script on the VPS after changing `kong.yml` patterns.

## Build checklist (operators)

1. Confirm [`erp-mobile-app/.env.production`](../../erp-mobile-app/.env.production) matches VPS (URL + anon length, e.g. **176** chars for anon after canonical `ANON_KEY=` sync).
2. `cd erp-mobile-app && npm run cap:sync:android:prod`
3. `cd android && ./gradlew assembleDebug` (or `gradlew.bat` on Windows) — or `assembleRelease` with signing.

## Related docs

- [`docs/infra/AUTH_PRODUCTION_LOCKED.md`](AUTH_PRODUCTION_LOCKED.md) — web + single source of truth for keys.
- [`docs/infra/AUTH_FIX_HISTORY_LOG.md`](AUTH_FIX_HISTORY_LOG.md) — recent auth bridge incidents and fixes.

## Change policy

Any PR that changes `erp-mobile-app/src/lib/supabase.ts` URL selection, mobile `.env` layout, or Kong mobile CORS must **update this file** and get explicit review for native vs web behavior.
