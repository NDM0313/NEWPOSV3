# BASELINE.md — Acceptance (re-verified 2026-07-17)

| Item | Value |
|------|--------|
| **Branch** | `feature/mobile-single-core-finalization` |
| **Product HEAD (APK source)** | `93cd8436087869f9d839f1c5650626d047a33a98` |
| **Evidence HEAD** | `a7676a07` + acceptance tooling commits (pending) |
| **Worktree** | `/Users/ndm/Documents/Development/CursorDev/NEWPOSV3-mobile-sc-phase2` |
| **Dirty main** | untouched (`812c2871`) |

## Pre-QA commands & results

| Command | Result | Duration (approx) |
|---------|--------|-----------------|
| `cd erp-mobile-app && npm run test:run` | **89 PASS / 0 FAIL** | ~5s |
| `npm run test:unified-ledger` (repo root) | **350 PASS / 0 FAIL** | ~8s |
| `cd erp-mobile-app && npm run typecheck` | **PASS** | ~40s |
| `npm run build:mobile:prod` | **PASS** (prior run) | — |
| `npm run cap:sync:android:prod` | **PASS** (prior run) | — |
| `cd android && ./gradlew assembleDebug` | **PASS** (prior run) | — |

## App / APK identity

| Field | Value |
|-------|--------|
| versionName | 1.0.5 |
| versionCode | 39 |
| APK path | `erp-mobile-app/android/app/build/outputs/apk/debug/app-debug.apk` |
| APK SHA-256 | `d15114fc2a53c735c8004f06267568fc33ecc6575aa8cb798fe9f4c88b57f440` |
| APK built from | `93cd8436087869f9d839f1c5650626d047a33a98` |

No product-code commits after APK build; acceptance tooling/docs may commit without APK rebuild.
