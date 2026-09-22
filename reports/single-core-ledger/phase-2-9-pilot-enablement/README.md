# Phase 2.9 Pilot Enablement — Evidence Pack

**Plan:** [`docs/accounting/SINGLE_CORE_LEDGER_PHASE_2_9_PILOT_ENABLEMENT_PLAN.md`](../../../docs/accounting/SINGLE_CORE_LEDGER_PHASE_2_9_PILOT_ENABLEMENT_PLAN.md)  
**Branch:** `feature/single-core-ledger-phase-2-9-pilot-enablement-plan`  
**Base:** `feature/single-core-ledger-phase-2-8-preview-qa-signoff` @ `807fdbcd`  
**Pilot company:** DIN CHINA `30bd8592-3384-4f34-899a-f3907e336485`  
**Pilot screen:** Ledger V2 (`unified_ledger_screen_ledger_v2`)

This folder holds evidence for the DIN CHINA single-screen pilot. **No flag SQL is executed as part of the plan PR** — populate artifacts during ops execution only.

## Folder layout

| Path | Purpose |
|------|---------|
| `pre-flag/` | Baseline before any flag enablement (2.8 waiver clearance) |
| `post-stage-1/` | After `unified_ledger_pilot` ON only |
| `post-stage-2/` | After engine + `unified_ledger_screen_ledger_v2` ON |
| `rollback/` | Rollback drill logs |

## Artifact templates

JSON templates in this directory use `_TEMPLATE` suffix — copy and fill during live QA; do not commit secrets or PII.

| Template | Fill when |
|----------|-----------|
| `pre-flag-flags_TEMPLATE.json` | Stage 0 baseline SQL read |
| `post-stage-1-flags_TEMPLATE.json` | After Stage 1 SQL |
| `post-stage-2-flags_TEMPLATE.json` | After Stage 2 SQL |
| `live-qa-pre-flag_TEMPLATE.json` | §9 checklist complete |
| `live-qa-post-stage_TEMPLATE.json` | §10 per stage |
| `rollback-drill_TEMPLATE.md` | Rollback dry-run or incident |

## Boundaries

- No `feature_flags` writes in plan-only commits
- No VPS deploy or merge to `main` without ops approval
- Stage 3 (default loader swap) is out of scope for 2.9
