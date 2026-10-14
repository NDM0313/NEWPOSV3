# Phase 2.13 — Party Ledger loader final report

**Status:** `PHASE 2.13 PARTY LEDGER LOADER ON PASS — unified main live for DIN CHINA`

| Field | Value |
|-------|-------|
| Deploy target | `https://erp.dincouture.pk` |
| Deploy label | `phase-213-prod` |
| Local branch | `feature/single-core-ledger-phase-2-9a3-preview-deploy-plan` |
| Code sync | SCP to VPS (uncommitted local working tree) |
| Company | DIN CHINA `30bd8592-3384-4f34-899a-f3907e336485` |
| Tests | `npm run test:unified-ledger` **206/206 PASS** |
| Build | `npm run build` PASS |

## Enabled flags (production live)

| Flag | State |
|------|-------|
| `unified_ledger_screen_party_ledger` | **ON** |
| `unified_ledger_loader_party_ledger` | **ON** |
| LV2 / AS / TB loaders | **ON** (unchanged) |
| Roznamcha / Cash-Bank | **OFF / absent** |

## Party Ledger golden

| Metric | Value |
|--------|-------|
| Legacy golden (baseline) | PKR **216,300** (MR JALIL) |
| Unified main closing | PKR **216,300** (matches golden) |

## QA summary

| Phase | Result |
|-------|--------|
| Baseline (loader OFF) | PASS |
| Candidate (loader ON) | PASS |
| L1 rollback | PASS → re-enabled |
| Soak T0 / mid / final | PASS |

## Cross-screen gates

| Screen | Loader | MR JALIL / totals |
|--------|--------|-------------------|
| Ledger V2 | unified | PKR 216,300 |
| Account Statement | unified | PKR 216,300 |
| Trial Balance | unified | PKR 407,957,271.02 D=C |
| Admin Compare Pilot Batch | — | 9/9 |

## Export / share

Waived for Party Ledger on-page export (no PDF/Excel on screen). Preview JSON compare export OK.

## Soak summary

T0, mid, final checkpoints: flags stable, unified main stable, golden unchanged, no cross-screen regression.

## Waivers

1. **Preview tunnel** — same as 2.12; production-safe baseline pattern used.
2. **Party Ledger export** — no on-page PDF/Excel; documented N/A.

## Rollback status

L1 rollback tested successfully; loader re-enabled. No production rollback required.

## Blocked future items

- Roznamcha unified loader rollout (not started)
- Cash/Bank parity / loader (not started)
- Other company expansion (not started)

## Evidence

`reports/single-core-ledger/phase-2-13-party-ledger-loader/`
