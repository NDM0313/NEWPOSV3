# Capacitor sync — MOBILE APK INTERNAL QA BUILD

**Generated:** 2026-07-01  
**Status:** PASS

## Command

`npm run cap:sync:android:prod` (via `npm run android:debug:win`)

## Steps

1. `build:mobile:prod` — tsc + Vite production bundle
2. `verify-dist-for-capacitor.mjs` — dist integrity check
3. `npx cap sync android` — web assets + plugin update
4. `verify-dist-for-capacitor.mjs` — post-sync check

## Verification

- Android project updated (9 Capacitor plugins)
- No secrets copied into git
- No unintended config changes
- APK not built during sync step (Gradle ran separately)
