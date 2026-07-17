# PR_BODY.md

## Title

`feat(mobile): complete Single Core reporting alignment`

## Product HEAD

`a7471520` · debug APK SHA `26ec4a19…` · version `1.0.5` (39)

## Architecture / loaders

Central Single Core adapter; Party/Worker/Account/Roznamcha/Cash Flow unified contracts; Aging operational labelled; fail-loud Account Ledger + Aging; write-success invalidation coverage.

## New-head targeted parity (this phase)

Three companies · Account Ledger · Aging · Party/Worker · Roznamcha/Cash Flow · TB — **0 FAIL**  
Evidence: `reports/mobile-single-core-final-acceptance-a7471520/`

## Role / device gates

| Gate | Status |
|------|--------|
| Salesman live RLS | `NOT_RUN_CREDENTIAL_GATED` |
| Limited | `QA_IDENTITY_NOT_AVAILABLE` |
| Branch-restricted | `QA_IDENTITY_NOT_AVAILABLE` |
| Physical device | `NOT_RUN_DEVICE_GATED` |
| Emulator | `EMULATOR_ENVIRONMENT_UNAVAILABLE` |
| Admin RLS | historical PASS (not re-run) |

## Tests / build

89 / 350 / typecheck / build — retained green; lockfile unchanged; no product code this phase.

## Mutations

NONE · Migrations NONE · 4100 NONE · R8-R2 NONE

## Unsigned release

`app-release-unsigned.apk` exists — **not** production signed; **not** Play Store uploaded.

## Merge

**Not approved.** Requires `APPROVE_MOBILE_SINGLE_CORE_FINALIZATION_MERGE`  
Readiness: `ENGINEERING_COMPLETE_AWAITING_RESOURCES`
