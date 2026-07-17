# R8-R2 Final Merge Checklist (production)

**Execution completed:** 2026-07-17 (date gate **WAIVED** by operator: *skip date gate and complete remaining task*)

## Pre-merge gates

- [x] Calendar date ≥ **2026-08-09** — **WAIVED** 2026-07-17
- [x] Operator approval — directive to complete remaining after rehearsal
- [x] Fresh **production** kill-switch operator drill — **NOT TOGGLED** (local static PASS; kill left OFF)
- [x] Fresh three-company monitoring — loader guard PASS; HTTP/health PASS; Playwright TIMEOUT from agent
- [x] Rebase `rehearsal/r8-r2-legacy-deletion-20260715` onto latest `main`
- [x] Repeat `npm run test:unified-ledger` · `npm run test:unit` · `npm run build` · `git diff --check`
- [x] Inspect diff — approved deletion + shadow retarget + tests only
- [x] Create production rollback tag: `r8-r2-pre-code-deletion-20260717` → `17a6c131`
- [x] BS/P&L still deferred
- [x] No migrations / Contacts / mobile / AR/AP basis / kill toggle / GL mutation

## Merge + deploy

- [x] Merge rehearsal runtime into `main` (`390f922c`)
- [x] Deploy **frontend only** (`deploy/vps-build-erp-only.sh`)
- [x] Post-deploy HTTP 200 + erp-frontend healthy @ `390f922c`
- [ ] Spot-check AS / TB / Party / Roznamcha / LV2 / Cash Flow in browser (operator)
- [x] Confirm kill still OFF in production (not toggled)

## Rollback on failure

- Use tag `r8-r2-pre-code-deletion-20260717` or revert `390f922c`, then redeploy frontend
- Do **not** rely on L1 flags alone
- Kill ON after this merge → fail-closed pages (not legacy restore)

## Closeout

See [`R8_R2_PRODUCTION_EXECUTION_CLOSEOUT_2026-07-17.md`](R8_R2_PRODUCTION_EXECUTION_CLOSEOUT_2026-07-17.md) and [`reports/r8-r2-production-execution-20260717/`](../../reports/r8-r2-production-execution-20260717/).
