# Play Store Release Readiness — OLD ERP Mobile

**Date:** 2026-07-11  
**Scope:** `erp-mobile-app/` — DIN Collection ERP (`com.dincouture.erp`)  
**Status:** Preflight complete — **upload not performed**

## Confirmed ready

| Item | Value |
|------|--------|
| Application ID | `com.dincouture.erp` |
| Display name | Din Collection |
| versionName | `1.0.5` |
| versionCode | `39` |
| compileSdk / targetSdk | **36** |
| minSdk | **24** |
| Java | **17** |
| Capacitor | **8.x** |
| Production API base | `https://erp.dincouture.pk` (locked pattern) |
| Admin device QA | **PASS 21/21** (prior) |
| Salesman login QA | **PASS** (2026-07-09 office) |
| Release signing wired | `keystore.properties` + `release-key.jks` (local, gitignored) |
| Release build docs | `erp-mobile-app/README.md`, `android/README_BUILD.md`, `docs/APK_BUILD_WINDOWS.md` |
| Build scripts | `npm run cap:sync:android:prod`, `android:bundle:win`, `android:apk:release:win` |

## Needs operator input

| Item | Gap |
|------|-----|
| Play Store upload decision | Operator must approve release track and timing |
| versionCode bump | Still **39** since 2026-06-08 — must increment before upload |
| Salesman extended QA (rows 4–20) | Optional; Pixel not connected 2026-07-11 |
| Internal testing testers | Play Console tester emails not documented |
| Release notes | No Play-specific notes prepared for v1.0.6+ |

## Needs secure signing access

| Item | Status |
|------|--------|
| `android/keystore.properties` | Present locally (gitignored) |
| `android/app/release-key.jks` | Present locally (gitignored) |
| Google Play App Signing enrollment | Not documented |
| Upload keystore backup / escrow | Operator responsibility |

## Needs asset / policy work

| Item | Status |
|------|--------|
| Privacy policy URL | **Not found** in repo or linked in app |
| Play Data Safety form | **Not prepared** |
| Content rating questionnaire | **Not prepared** |
| Store listing (screenshots, feature graphic, descriptions) | **Not prepared** |
| Fresh release AAB | **No** `bundle/release/app-release.aab` found |
| `releases/APK_UPDATE.md` | Last entry 2026-06-08 — stale vs audit date |
| Cleartext traffic (`usesCleartextTraffic=true`) | May trigger Play review questions |
| Sensitive permissions (camera, Bluetooth, storage) | Data Safety answers needed |

## Final upload approval required

**Blocker:** `PLAY_STORE_FINAL_UPLOAD_APPROVAL_REQUIRED`

Hard rules observed this session:

- No AAB/APK generated, staged, or committed
- No keystore passwords logged or copied
- No Play Console access
- No version bump applied
- No upload to any track

## Recommended operator sequence (when approved)

1. Obtain `PLAY_STORE_FINAL_UPLOAD_APPROVAL_REQUIRED` clearance.
2. Bump `versionCode` (and optionally `versionName`) in `android/app/build.gradle`.
3. `npm run cap:sync:android:prod` → `npm run android:bundle:win`.
4. Publish privacy policy at stable HTTPS URL; link in Play Console.
5. Complete Data Safety, content rating, store listing assets.
6. Upload AAB to **Internal testing**; add testers.
7. Optionally reconnect Pixel and complete Salesman checklist rows 4–20.
8. Update `releases/APK_UPDATE.md` and `docs/MOBILE_RELEASE_PLAN.md`.

## Evidence references

- `reports/mobile-salesman-qa-readiness-after-day15-20260709/salesman-role-qa-pass.md`
- `docs/MOBILE_RELEASE_PLAN.md`
- `docs/infra/MOBILE_APK_LOCKED_PATTERN.md`
- `reports/mobile-apk-internal-qa-build-20260701/`
