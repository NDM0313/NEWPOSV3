## Project boundary

OLD ERP / DIN Collection Capacitor mobile (`erp-mobile-app/`) only — not FX, `POS/`, or Flutter apps.

## Starting baseline

- Branch: `feature/mobile-single-core-finalization`
- Product HEAD (APK): `93cd8436087869f9d839f1c5650626d047a33a98`

## Implementation summary

- Party / Worker / Roznamcha / Cash Flow Single Core wiring
- Fail-loud + explicit fallback notices; accounting write invalidation helper
- Role hub gating tests (`finalization.test.ts`)

## Tests

| Suite | Result |
|-------|--------|
| Mobile | 89 PASS / 0 FAIL |
| Unified ledger | 350 PASS / 0 FAIL |
| Typecheck | PASS |
| Prod mobile build + debug APK | PASS |

## Live parity (read-only production RPC)

| Company | PASS | EXPECTED_BASIS_DIFF | FAIL |
|---------|------|---------------------|------|
| DIN CHINA | 8 | 3 | 0 |
| DIN BRIDAL | 8 | 3 | 0 |
| DIN COUTURE | 9 | 2 | 0 |

Web production spotcheck (DIN CHINA): Roznamcha, Account Statement, Cash Flow, TB, Party Ledger, Ledger V2 — all `loader=unified` — **OVERALL PASS**

## Server / RLS

- Admin cross-company TB: **PASS** (`ACCESS_DENIED: company scope mismatch`)
- Salesman / limited live sessions: **NOT_RUN_CREDENTIAL_GATED**
- Client hub gates: **PASS** (unit tests)

## Device QA

| Channel | Result |
|---------|--------|
| Emulator APK | `EMULATOR_QA_FAIL` (WebView automation blocked) |
| Mobile web (same bundle, :5175) | **9/9 PASS** — see `MOBILE_WEB_QA.md` |
| Physical device | `NOT_RUN_DEVICE_GATED` |

## Build / APK

- Path: `erp-mobile-app/android/app/build/outputs/apk/debug/app-debug.apk`
- SHA-256: `d15114fc2a53c735c8004f06267568fc33ecc6575aa8cb798fe9f4c88b57f440`
- versionName 1.0.5 / versionCode 39

## Safety

- Production mutations: **NONE**
- Migrations: **NONE**
- 4100 reclass: **NONE**
- R8-R2 deletion: **NONE**

## Rollback

Revert feature branch or disable unified loader flags — no SQL rollback required. See `ROLLBACK.md`.

## Residual risks

See `RESIDUAL_RISKS.md` — salesman live RLS, physical device, contact-list vs statement basis labelling.

## Merge recommendation

`NOT_READY_FOR_MERGE` — complete salesman/branch live RLS + physical-device QA; then operator supplies exact phrase `APPROVE_MOBILE_SINGLE_CORE_FINALIZATION_MERGE`.

**Do not merge without that phrase.**
