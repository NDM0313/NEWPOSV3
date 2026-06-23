# Single Core Ledger — Deploy Report (Phase 1.5 tooling)

**Date:** 2026-06-23  
**Branch deployed:** `feature/single-core-ledger-phase-1-5-systemwide`  
**Deploy target:** `https://erp.dincouture.pk/` (frontend only, isolated clone pattern)

---

## What was deployed

- Phase 1.5 **code + CLI validation tooling** (staging guards, VPS clone scripts, tie-out PG mode)
- Migration SQL files in repo (enum cast fixes) — **not applied to live `postgres` DB**
- `unified_ledger_engine` feature flag remains **OFF** for all users

## What was NOT deployed / not activated

| Item | Status |
|------|--------|
| Phase 1.5 migrations on production `postgres` | **NOT RUN** |
| `unified_ledger_engine` enabled | **NO** |
| Production ledger screen replacement (Phase 2) | **NOT STARTED** |
| Payment contact auto-backfill on live data | **NOT RUN** |
| Merge to `main` | **NO** |

## Gate status

**PHASE 1.5 NOT VALIDATED** — diagnostics strict_fail 2/3 companies on clone. DIN CHINA pilot tie-out **PASS**.

## Rollback

Isolated deploy dir on VPS: `/root/NEWPOSV3-phase-15-deploy`  
Rollback tag pattern: `deploy-erp:rollback-before-phase15-<timestamp>`

## Next step for full Single Core completion

1. Remediate `payments_missing_contact_sale_linked` on **staging clone only** (design + review)
2. Re-run diagnostics until Gate A
3. Apply Phase 1.5 migrations to production **only after explicit approval**
4. Phase 2 screen wiring behind flag
