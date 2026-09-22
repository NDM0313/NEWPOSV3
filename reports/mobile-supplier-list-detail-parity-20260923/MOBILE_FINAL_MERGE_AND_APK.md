# Mobile Supplier List Fix — Final Merge + APK

**Verdict: `MOBILE_SUPPLIER_LIST_FIX_MERGED_AND_APK_READY`**

**Date:** 2026-09-23

## SHAs

| Item | SHA |
|------|-----|
| Old main | `d84430b4d9d81262ba3549eb4ee405fd9cd708e9` |
| Source branch tip | `139441f29a674f39aedacfcb071c987f0d13b43a` (`fix/mobile-supplier-list-detail-parity`) |
| Code fix | `bd8d73af44ba19da3dad76235fdedf36ce6eda45` |
| Merge commit | `14214abc6c5fd4ddb1322eb652f4d7e9f4293646` |
| Version bump | `ec39c4d19d09dfe5aee3f773f05ded1b4ec2e44d` |
| Final main | `ec39c4d19d09dfe5aee3f773f05ded1b4ec2e44d` |

Merge: normal `--no-ff`. Branch was cleanly ahead of main (0 behind / 4 ahead; merge-base = old main). No conflicts. No force push.

## Why owner hard-refresh still showed zeros

`fix/mobile-supplier-list-detail-parity` was **not on main**. Any rebuild from main lacked the list fix. This merge puts it on main; install the new APK (1.0.7 / 42).

## Pre-merge verification

| Check | Result |
|-------|--------|
| `npx tsx --test` supplierBusinessGl + supplierListDetailParity | **10 PASS** |
| `npm run typecheck` | **PASS** |
| `npm run build:mobile` | **PASS** |

## Mobile version

| Field | Old | New |
|-------|-----|-----|
| versionName | 1.0.6 | **1.0.7** |
| versionCode | 41 | **42** |
| `APK_BUILD_CODE` (debug UI) | 39 (stale) | **42** |

## Cap sync + APK

| Step | Result |
|------|--------|
| `npm run build:mobile:prod` | **PASS** |
| `npx cap sync android` | **PASS** |
| `./gradlew assembleDebug` | **PASS** |
| Play Store | **NO** |

### APK paths

- Gradle output: `erp-mobile-app/android/app/build/outputs/apk/debug/app-debug.apk`
- Owner copy (gitignored): `erp-mobile-app/releases/erp-mobile-1.0.7-vc42-debug-list-parity.apk`

| Meta | Value |
|------|-------|
| Size | **35,684,717** bytes (~34.0 MiB) |
| SHA-256 | `93f3ac09df864a9a3e3996275fb8088ef4c313db9a302606879c421b8c9d6765` |
| Build timestamp (UTC) | 2026-09-22T22:08Z (approx assemble completion) |
| Web bundle | `assets/public/assets/index-Dq0qVTKI.js` |
| Bundle SHA-256 | `b6ddaa05da4e6e1d6f6fae8ed50645c80b4e05ec915017b999260a3fb123057b` |

## APK contains fix (not Git-only)

Extracted from APK web assets:

| Marker | Present |
|--------|---------|
| `ct:v2biz` cache key | **YES** (1) |
| `Supplier Business GL unavailable` fail-loud copy | **YES** (3) |
| Source: PartyLedgerReport supplier path trusts getContacts only | **YES** (comments at L159–160) |
| Duplicate list batch in supplier PartyLedgerReport path | **REMOVED** on main |

## Golden expectations (Supplier Ledger list = Detail all-time Business)

| Supplier | Expected list Business |
|----------|-----------------------:|
| ARIF LHR | **39,937** payable |
| ALAM BNRS | **1,105,100** payable |
| ABDULLAH KHTK | **1,672,116** payable |
| AMIR SKT | **557,350** payable |
| MARYAM NSR KHTK | **1,368,082** payable |
| HAFIZ SAEED BNRS | **527,028** payable |

Negative Business GL = advance/recoverable (not payable). TRUE_ZERO may show Rs. 0.

## Safety

| Item | Result |
|------|--------|
| Database mutations | **0** |
| Migrations | **NONE** |
| JEs / account_ids / TB / BS | unchanged |
| Graphify | **NO** |
| Device tested | **NO** |
| Play Store published | **NO** |

## Owner install note

Install the **1.0.7 (42)** debug APK above (not a hard-refresh of an older main-based build). First online Supplier Ledger refresh will write `ct:v2biz` cache with Business balances.
