# BUILD_RESULTS.md

| Step | Result | Notes |
|------|--------|-------|
| `npm run build:mobile:prod` | **PASS** | tsc + vite production build |
| `npm run cap:sync:android:prod` | **PASS** | assets copied; sync finished |
| `./gradlew assembleDebug` | **PASS** (with local overrides) | See gates below |

### Android debug APK

Path (worktree):  
`erp-mobile-app/android/app/build/outputs/apk/debug/app-debug.apk`  
(~35 MB, built 2026-07-17)

### Environment / tooling gates (not introduced by Phase 2 code)

1. Committed `org.gradle.java.home=C:/Program Files/...` breaks Mac unless temporarily commented for the local build (restored afterward; **not committed**).
2. Worktree needed `local.properties` `sdk.dir` (gitignored) copied from main tree.
3. Worktree used symlink `node_modules` → main app `node_modules` (gitignored). Cap sync briefly rewrote `capacitor.settings.gradle` to absolute symlink paths — **reverted; not committed**.
