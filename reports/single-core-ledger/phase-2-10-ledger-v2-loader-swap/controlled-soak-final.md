# Phase 2.10D — Controlled loader soak (final checkpoint)

**Timestamp:** 2026-06-26T13:13:40Z  
**Checkpoint:** final (accelerated in-session; ops owns wall-clock T+2h monitoring)  
**Loader flag:** **ON** — soak PASS, no rollback executed  
**Overall:** **PASS WITH WAIVERS**

## Final verification

| Check | Result |
|-------|--------|
| `data-ledger-v2-main-loader="unified"` | PASS |
| MR JALIL PKR 216,300 | PASS |
| Preview `legacy_shadow` | PASS |
| Export PDF/Excel/CSV PKR 216,300 | PASS |
| Pilot Batch 9/9 | PASS |
| Admin Compare Party MR JALIL | PASS |
| Wrong company / screen flags | none observed |
| Production frontend | untouched |
| User complaints | none |
| RPC/console error spike | none observed |

## Waivers

1. **Staff visibility** — Staff preview toggles hidden not verified (no DIN CHINA staff credentials). Loader flag is company-scoped; preview UI remains role-gated. **Must be reviewed again before production frontend deploy.**

2. **Non-golden party spot-check** — Waived at mid/final; automated dropdown did not select a distinct party entity.

3. **Accelerated soak timeline** — Start/mid/final QA checkpoints executed in one ops session. Wall-clock 2-hour window monitoring remains ops responsibility before production frontend deploy.

## Rollback criteria

None triggered. L1 rollback SQL available: `phase-210-rollback-loader-ledger-v2.sql`

## Post-soak state

`unified_ledger_loader_ledger_v2 = true` for DIN CHINA — **intentionally left ON** after soak PASS pending production frontend deploy planning.

## Artifacts

- `screenshots/210d-soak-final-ledger.png`
- `screenshots/210d-soak-final-export-pdf-preview.png`
- `screenshots/210d-soak-final-admin-compare.png`
