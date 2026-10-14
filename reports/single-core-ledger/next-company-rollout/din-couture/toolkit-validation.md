# DIN COUTURE rollout toolkit validation

**Date:** 2026-06-27  
**Status:** VALIDATED — not executed (rollout blocked on credentials)

---

## SQL pack location

`scripts/single-core-ledger/din-couture/`

| Category | Files | Company id scoped |
|----------|-------|-------------------|
| Preflight / monitoring | `dc-preflight-flags.sql`, `dc-monitoring-flags-pipe.sql` | Yes — `2ab65903-…` |
| Enable pilot / engine | `dc-enable-pilot.sql`, `dc-enable-engine.sql` | Yes |
| Enable screens (5) | `dc-enable-screen-*.sql` | Yes |
| Enable loaders (5) | `dc-enable-loader-*.sql` | Yes |
| Rollback (all stages) | `dc-rollback-*.sql` | Yes |
| Config | `dc-company-config.json` | Yes |

**26 SQL files + 1 config JSON** — mirrored from DIN BRIDAL pack with DIN COUTURE company id only.

---

## Safety checks

- No GL / journal / payment mutation SQL
- No migration files
- No bulk multi-flag enable scripts
- Rollback SQL present for every enable step
- DIN CHINA / DIN BRIDAL ids not targeted in enable SQL

---

## Golden capture script

`scripts/single-core-ledger/run-golden-capture-din-couture.mjs` — created, not passed (wrong QA user company).

---

## Execution status

**Not executed** — blocked before Stage 1 pending DIN COUTURE browser credentials.
