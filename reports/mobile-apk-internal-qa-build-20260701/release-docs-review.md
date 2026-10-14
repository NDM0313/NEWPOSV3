# Release docs review — MOBILE APK INTERNAL QA BUILD

**Generated:** 2026-07-01

## App identity

| Field | Value |
|-------|-------|
| App ID / package | `com.dincouture.erp` |
| versionCode | 39 |
| versionName | 1.0.5 |
| Native API base | `https://erp.dincouture.pk` (locked pattern) |
| Supabase | `https://supabase.dincouture.pk` |

## Build commands (approved)

1. `npm run build:mobile:prod` — tsc + Vite production bundle
2. `npm run cap:sync:android:prod` — verify dist + `npx cap sync android`
3. `npm run android:debug:win` — full sync + `gradlew.bat assembleDebug`

## APK output

- Gradle default: `erp-mobile-app/android/app/build/outputs/apk/debug/app-debug.apk`
- Internal QA artifact copy: `erp-mobile-app/releases/internal-qa/20260701/`

## Signing

- Release signing optional via `android/keystore.properties`
- **Internal QA:** debug APK used (no release keystore required)

## Rollback / prior APK policy

- Keep local copies under `erp-mobile-app/releases/`
- Do **not** commit APK/AAB to git
- Public/Play Store release requires separate operator approval

## Docs reviewed

- `docs/MOBILE_RELEASE_PLAN.md`
- `docs/infra/MOBILE_APK_LOCKED_PATTERN.md`
- `docs/ANDROID_APK_BUILD.md`
- `docs/PWA_VS_NATIVE_LIMITS.md`
