# APK_INTEGRITY.md

## Debug APK (primary engineering artifact)

| Field | Value |
|-------|-------|
| Path | `erp-mobile-app/android/app/build/outputs/apk/debug/app-debug.apk` |
| SHA-256 | `26ec4a1998c8353ec6692893120e4c7ed16bb60bbd33f573b841cdf6d2f07e79` |
| Previous SHA (pre-engineering) | `d15114fc2a53c735c8004f06267568fc33ecc6575aa8cb798fe9f4c88b57f440` |
| versionName | `1.0.5` |
| versionCode | `39` |
| Rebuild reason | Product code changed (invalidation + fail-loud) |
| Cap sync | PASS before assembleDebug |
| Gradle | assembleDebug PASS (local JDK 21 via `JAVA_HOME`; machine path not committed) |

## Unsigned release APK (supported, not store-ready)

| Field | Value |
|-------|-------|
| Path | `erp-mobile-app/android/app/build/outputs/apk/release/app-release-unsigned.apk` |
| SHA-256 | `67432ac3657ff8af6fb3a91cae29e00bc6c3c9fd7d005b35f55c6170f07e1403` |
| Keystore | NONE (`hasReleaseSigning=false`) |
| Play Store | NOT uploaded — RELEASE_GATED |

## Gradle properties hygiene

Removed committed Windows-only `org.gradle.java.home` absolute path from `android/gradle.properties` (left commented). Local JDK must be supplied via `JAVA_HOME` or `npm run fix:gradle-jdk` — do not commit machine paths.
