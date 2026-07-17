## Project boundary

OLD ERP / DIN Collection Capacitor mobile (`erp-mobile-app/`) only — not FX, `POS/`, or Flutter apps.

## Baseline

- Branch: `feature/mobile-single-core-finalization`
- Product/APK HEAD: `93cd8436087869f9d839f1c5650626d047a33a98`
- Evidence HEAD: (closure commit pending)
- Dirty `main` (`812c2871`) untouched

## Implementation

Party / Worker / Roznamcha / Cash Flow Single Core wiring; fail-loud + explicit fallback; accounting write invalidation; role hub tests.

## Tests

- Mobile **89 PASS**; Unified ledger **350 PASS**; Typecheck **PASS**; Prod build **PASS**

## Live parity

DIN CHINA / BRIDAL / COUTURE read-only unified RPC: **0 FAIL**  
Web six-screen spotcheck: **OVERALL PASS** (`loader=unified`)

## Live role / RLS

| Role | Result |
|------|--------|
| Admin own-company TB | **PASS** |
| Admin cross-company denial | **PASS** (`ACCESS_DENIED`) |
| Salesman | `NOT_RUN_CREDENTIAL_GATED` |
| Limited/easy | `NOT_RUN_CREDENTIAL_GATED` |
| Branch-restricted | `NOT_RUN_CREDENTIAL_GATED` |

## Device QA

| Channel | Result |
|---------|--------|
| Emulator authenticated APK | `EMULATOR_QA_FAIL` |
| Physical device | `NOT_RUN_DEVICE_GATED` |
| Mobile-web same bundle (supplementary) | **9/9 PASS** |

## APK

- Path: `erp-mobile-app/android/app/build/outputs/apk/debug/app-debug.apk`
- SHA-256: `d15114fc2a53c735c8004f06267568fc33ecc6575aa8cb798fe9f4c88b57f440`
- versionName 1.0.5 / versionCode 39
- Product source unchanged after APK build

## Safety

Production mutations **NONE** · Migrations **NONE** · 4100 **NONE** · R8-R2 deletion **NONE**

## Residual risks

See `RESIDUAL_RISKS.md` — salesman passwords, physical device, emulator stability.

## Rollback

See `ROLLBACK.md` — revert/feature-flag; no SQL rollback.

## Merge recommendation

`NOT_READY_FOR_MERGE`

Do not merge without exact phrase `APPROVE_MOBILE_SINGLE_CORE_FINALIZATION_MERGE` after remaining gates close.
