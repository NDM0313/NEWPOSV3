# Deploy decision — Phase 3A

**Decision:** **DEPLOYED** @ 2026-06-29 — operator approved Phase 3A-PROD

## Production deploy

- **URL:** https://erp.dincouture.pk
- **Commit:** `4a5dc304`
- **Method:** `deploy/vps-build-erp-only.sh` on `dincouture-vps`
- **Evidence:** [`production-deploy-notes.md`](production-deploy-notes.md) · [`post-deploy-smoke.md`](post-deploy-smoke.md) · [`post-deploy-monitoring.md`](post-deploy-monitoring.md)

## Constraints honored

- Phase 3A preview-only UI deployed to production.
- Legacy BS/P&L default behavior unchanged.
- Loader swap not approved.
- Finance golden capture still required.
- R7/R8/next company remain blocked.
- No migrations and no GL/data mutations.

## Post-deploy

- Three-company monitoring **PASS** after deploy
- Operator: hard refresh when validating preview UI (service worker)
