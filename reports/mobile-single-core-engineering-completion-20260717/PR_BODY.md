# PR_BODY.md

## Title

`feat(mobile): complete Single Core reporting alignment`

## Project scope

OLD ERP / DIN Collection Capacitor mobile (`erp-mobile-app`, `com.dincouture.erp`) only. Not FX, not `POS/`, not Flutter apps.

## Product baseline

- Branch: `feature/mobile-single-core-finalization`
- Pre-completion product/evidence boundary: `93cd8436`
- Engineering-completion product rebuild: debug APK SHA `26ec4a19…` (versionName `1.0.5` / versionCode `39`)
- Dirty `main @ 812c2871` untouched

## Architecture changes

- Central Mobile Single Core report adapter (`erp-mobile-app/src/api/singleCore/`)
- Unified Party / Roznamcha / Worker / Cash Flow wiring
- Accounting cache invalidation helper + post-write coverage expansion
- Role-based client report gates

## Report loader / basis / error policy

- Official GL loaders fail loud; labelled legacy/operational fallbacks where intentional
- Cash Flow: no silent legacy fallback
- Aging: operational `due_amount`, labelled; query errors no longer empty-success
- Account Ledger: unified failure shows labelled legacy notice

## Cache / invalidation

`invalidateAfterAccountingWrite` after successful sale/purchase/expense/rental/studio/JE write paths; company **and** branch switch clear list caches.

## Permission behaviour

Client gates remain; live Salesman/Limited/branch RLS still resource/approval gated (not claimed PASS).

## Tests / build

- Mobile: 89 PASS / 0 FAIL
- Unified Ledger: 350 PASS / 0 FAIL
- Typecheck: PASS
- Production mobile build: PASS
- Debug APK rebuild: PASS
- Unsigned release APK: produced (not signed for store)

## Live parity / Admin RLS (retained)

Three-company read-only parity 0 FAIL; Admin own + cross-company RLS PASS — evidence under `reports/mobile-single-core-final-closure-20260717/` and acceptance packs.

## Known unavailable gates

Salesman password, Limited/branch identities, physical device, stable emulator — RESOURCE/DEVICE/APPROVAL gated.

## No-mutation confirmation

Production financial mutations: **NONE** · Migrations: **NONE** · 4100 reclass: **NONE** · R8-R2 deletion: **NONE**

## Rollback

See `reports/mobile-single-core-engineering-completion-20260717/ROLLBACK.md`

## Residual risks

See `RESIDUAL_RISKS.md` in the same directory.

## Merge status

**Merge is not approved.** Requires exact phrase: `APPROVE_MOBILE_SINGLE_CORE_FINALIZATION_MERGE`

Merge readiness: `ENGINEERING_COMPLETE_AWAITING_RESOURCES`
