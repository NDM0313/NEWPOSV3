# Mobile / infra — remaining tasks (16 May 2026)

## Local machine

- **JDK 17:** Not installed; only **JDK 21** present. Set `JAVA_HOME` if Gradle complains; optional install Temurin 17 for parity with docs.
- **`JAVA_HOME` / `ANDROID_HOME`:** Often unset in shell; rely on `android/local.properties` `sdk.dir` (verify path exists).

## Secrets (never commit)

- **`erp-mobile-app/.env.production`:** Must exist locally for prod builds; stays gitignored. Copy from VPS `.env.production` / Kong anon as needed.
- **`erp-mobile-app/android/keystore.properties` + `.jks`:** Required for signed `assembleRelease` / `bundleRelease`; use `keystore.properties.example` as template.

## Offline (next phase)

- **Write queue coverage:** Extend `offlineStore` + `registerSyncHandlers` beyond current modules so all critical creates (where not yet queued) use the same pattern as purchase/sale offline paths.
- **Stale cache:** Optionally invalidate `listCache` on `dispatchMobileInvalidated` / after successful mutations so balances stay fresher without full reload.
- **Heavier lists:** Rental products, COA subsets, etc., if needed offline — same `listCache` pattern.

## Play Store / ops

- Bump `versionCode` / `versionName` in `android/app/build.gradle` before each Play upload.
- Run `npm run android:bundle` after signing setup; smoke-test barcode on device.

## Repo hygiene (optional)

- Add `graphify-out/cache/` to `.gitignore` if AST cache files should not appear as untracked noise; keep committing `GRAPH_REPORT.md` / `graph.json` only if team policy requires it (large files).
