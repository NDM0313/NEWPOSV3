# BASELINE.md

Generated: 2026-07-17 — Mobile Single Core engineering completion

| Field | Value |
|-------|-------|
| Worktree | `/Users/ndm/Documents/Development/CursorDev/NEWPOSV3-mobile-sc-phase2` |
| Branch | `feature/mobile-single-core-finalization` |
| Starting HEAD (evidence) | `382727db` |
| Product-code HEAD (pre-this-phase) | `93cd8436087869f9d839f1c5650626d047a33a98` |
| Origin branch | in sync at start of phase |
| Dirty original main | `812c2871` — **untouched** (separate working tree) |
| APK (pre-rebuild) | `erp-mobile-app/android/app/build/outputs/apk/debug/app-debug.apk` |
| APK SHA-256 (pre-rebuild) | `d15114fc2a53c735c8004f06267568fc33ecc6575aa8cb798fe9f4c88b57f440` |
| versionName / versionCode | `1.0.5` / `39` |

## Product vs evidence

- Product code last changed at lineage ending `bdbf602d` (tests) with functional product through `26752a96`…`4cdbae78`.
- Commit `93cd8436` and all later commits through `382727db` were **evidence/docs/scripts only** (confirmed: `git diff --name-only 93cd8436..382727db -- erp-mobile-app/src` empty).
- This engineering-completion phase **does** change product code (invalidation + fail-loud report gaps). New product HEAD will be recorded after commit + APK rebuild.

## Scope boundary

OLD ERP / DIN Collection Capacitor mobile only (`erp-mobile-app`, `com.dincouture.erp`). Out of scope: FX, `POS/`, Flutter apps.
