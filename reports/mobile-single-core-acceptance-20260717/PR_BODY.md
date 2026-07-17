## Project boundary
OLD ERP / DIN Collection Capacitor mobile (`erp-mobile-app/`) only — not FX, POS, or Flutter apps.

## Starting baseline
- Branch: `feature/mobile-single-core-finalization`
- HEAD: `93cd8436087869f9d839f1c5650626d047a33a98`

## Implementation summary
- Party / Worker / Roznamcha / Cash Flow Single Core wiring (prior commits on this lineage)
- Fail-loud + explicit fallback; accounting write invalidation
- Acceptance: read-only production RPC parity + DIN CHINA web unified spotcheck

## Tests
- Mobile 89 PASS; Unified-ledger 350 PASS; Typecheck PASS
- Web production six-screen spotcheck: OVERALL PASS (unified)

## Live parity
- DIN CHINA / BRIDAL / COUTURE: RPC matrix 0 FAIL (expected basis diffs for Aging, contact-list vs period, empty-worker companies)
- Details: `reports/mobile-single-core-acceptance-20260717/`

## Device
- Emulator: install/launch PASS; authenticated matrix incomplete → EMULATOR_QA_FAIL
- Physical: NOT_RUN_DEVICE_GATED

## Build / APK
- Prod build PASS
- APK SHA-256: d15114fc2a53c735c8004f06267568fc33ecc6575aa8cb798fe9f4c88b57f440

## Safety
- Production DB/GL mutations: NONE
- Migrations: NONE
- 4100 reclass: NONE
- R8-R2 deletion: NONE

## Rollback
Flag/kill-switch or revert feature branch — no SQL rollback.

## Residual risks
See RESIDUAL_RISKS.md (RLS live roles, device QA).

## Merge recommendation
`READY_FOR_APPROVAL` blocked until device + live RLS gates close; current status **`NOT_READY_FOR_MERGE`**.
Do not merge without exact phrase `APPROVE_MOBILE_SINGLE_CORE_FINALIZATION_MERGE`.
