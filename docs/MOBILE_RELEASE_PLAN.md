# ERP Mobile Release Plan — PWA + APK + iOS

**App:** Din Collection (erp-mobile-app)  
**Targets:** PWA → Android APK → iOS  
**Backend:** VPS Supabase `https://supabase.dincouture.pk`

## Safety Tag

```bash
git tag pwa-apk-ios-safe-point
git push origin pwa-apk-ios-safe-point
```

## Phase Overview

| Phase | Description | Status |
|-------|-------------|--------|
| **0** | Pre-check & branch safety | ✅ |
| **1** | Shared fixes (Supabase, PIN, Offline) | ✅ |
| **2** | PWA release | ✅ |
| **3** | Android APK | ✅ |
| **4** | iOS App | ✅ |
| **5** | PWA vs Native limits doc | ✅ |

## Quick Commands

```bash
# Local dev
cd erp-mobile-app && npm run dev

# Build
npm run build:mobile   # vite only (skip tsc)
npm run build         # full (tsc + vite)

# Capacitor sync
npm run cap:sync      # build + copy to android/ios
npm run cap:android   # open Android Studio
npm run cap:ios       # open Xcode
```

## Related Docs

- [ENV_STANDARDIZATION.md](./ENV_STANDARDIZATION.md) — Supabase URL/keys
- [PIN_LOGIN_AND_BRANCH_LOCK.md](./PIN_LOGIN_AND_BRANCH_LOCK.md) — PIN flow
- [OFFLINE_SYNC_MVP.md](./OFFLINE_SYNC_MVP.md) — Offline queue
- [PWA_DEPLOY.md](./PWA_DEPLOY.md) — PWA deployment
- [ANDROID_APK_BUILD.md](./ANDROID_APK_BUILD.md) — APK build
- [IOS_BUILD.md](./IOS_BUILD.md) — iOS build
- [PWA_VS_NATIVE_LIMITS.md](./PWA_VS_NATIVE_LIMITS.md) — Limitations matrix
