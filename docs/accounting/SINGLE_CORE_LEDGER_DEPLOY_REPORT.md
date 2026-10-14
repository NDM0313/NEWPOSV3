# Single Core Ledger — Deploy Report (Phase 1.5 tooling)

**Date:** 2026-06-23  
**Branch deployed:** `feature/single-core-ledger-phase-1-5-systemwide` @ `2739a12d`  
**Deploy target:** `https://erp.dincouture.pk/` (frontend, isolated clone pattern)  
**VPS deploy dir:** `/root/NEWPOSV3-phase-15-deploy`

---

## What was deployed

| Item | Status |
|------|--------|
| Phase 1.5 validation tooling (scripts, docs, PG tie-out mode) | **LIVE** (in repo on VPS) |
| JALIL ledger statement date-range parity (`AccountingDashboard` shared From/To) | **LIVE** (merged + redeployed) |
| `unified_ledger_engine` feature flag | **OFF** (unchanged) |
| Production ERP frontend build | **LIVE** — HTTP 200 verified |

## What was NOT deployed / not activated

| Item | Status |
|------|--------|
| Phase 1.5 migrations on production `postgres` | **NOT RUN** |
| `unified_ledger_engine` enabled for users | **NO** |
| Production ledger screen replacement (Phase 2) | **NOT STARTED** |
| Payment contact auto-backfill on live data | **NOT RUN** |
| Merge to `main` | **NO** |

## Gate status

**PHASE 1.5 NOT VALIDATED** — clone diagnostics: strict_fail 2/3 companies (DIN CHINA payment contact gaps, DIN BRIDAL branch risk). DIN CHINA pilot tie-out **PASS** 6/6.

## Rollback

Rollback tag pattern: `deploy-erp:rollback-before-phase15-<timestamp>`  
Redeploy previous image or run from `/root/NEWPOSV3` on `main` with `RUN_DEPLOY=1 bash deploy/deploy.sh`.

## Next step for full Single Core completion

1. Remediate `payments_missing_contact_sale_linked` on **staging clone only** (design + review)
2. Re-run diagnostics until Gate A (all companies strict pass)
3. Apply Phase 1.5 migrations to production **only after explicit approval**
4. Phase 2 screen wiring behind flag
