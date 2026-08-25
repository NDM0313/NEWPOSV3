# Post R8-R1 operational retirement watch

**Date:** 2026-07-10  
**Scope:** OLD ERP / DIN Collection — post-R8-R1 stabilization (read-only + CI)  
**R8 closeout commit:** `bc4528e5`

## R8-R1 status

| Item | Status |
|------|--------|
| Operational retirement | **COMPLETE** |
| Legacy loader code deleted | **No** (retained for rollback) |
| R8-R2 code deletion | **Not started** |
| DB migrations | **No** |
| Production GL mutation | **No** |

## Monitoring

| Check | Result |
|-------|--------|
| `npm run monitor:three-company-unified-ledger` | **PASS** |
| Artifact | `reports/single-core-ledger/operational-monitoring/three-company-monitoring-2026-07-10T16-52-09-806Z.md` |
| Loader guard (read-only) | **PASS** — only DIN CHINA, DIN BRIDAL, DIN COUTURE have loaders ON |
| DIN CHINA profile | PASS (16/19 checks) |
| DIN BRIDAL profile | PASS (18/19 checks) |
| DIN COUTURE profile | PASS (18/19 checks) |

## Tests and build

| Command | Result |
|---------|--------|
| `npm run test:unified-ledger` | **PASS** (336 tests) |
| `npm run test:unit` | **PASS** (187 tests, incl. canonical sales revenue) |
| `npm run build` | **PASS** |

## Kill switch

- `unified_ledger_kill_switch`: **OFF** (0 enabled rows in production flag snapshot)

## Safety

| Item | Status |
|------|--------|
| `migrations_run` | false |
| `gl_mutations` | false |
| Production data mutation | none |

## Rollback readiness

- Pre-R8 tag: `r8-pre-operational-retirement-20260710`
- Post-R8 tag: `r8-operational-retirement-complete-20260710`
- Legacy loader paths retained in repo for emergency rollback
- Per-company rollback SQL templates under `scripts/single-core-ledger/` (do not run without approval)

## R8-R2

**Not started.** Code deletion phase remains future after soak and kill-switch drill.
