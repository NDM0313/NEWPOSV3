# APK build — MOBILE APK INTERNAL QA BUILD

**Generated:** 2026-07-01  
**Status:** PASS — BUILT_INTERNAL_QA

## Command

`npm run android:debug:win` → `cap:sync:android:prod` + `gradlew.bat assembleDebug`

## Result

- **Build type:** debug (internal QA)
- **Gradle:** BUILD SUCCESSFUL in 53s
- **Play Store:** NOT released
- **Public release:** NOT released

## Notes

Debug APK chosen for internal QA — no release keystore required. Release signing available via `android/keystore.properties` if needed for a future signed internal build.
