# Deploy decision — Phase 3B

**Decision:** **DEPLOYED** @ 2026-06-29 — operator approved Phase 3B-PROD

## Production deploy

- **URL:** https://erp.dincouture.pk
- **Commit:** `99f2e3b3`
- **Method:** `deploy/vps-build-erp-only.sh` on `dincouture-vps`
- **Evidence:** [`production-deploy-notes.md`](production-deploy-notes.md) · [`post-deploy-smoke.md`](post-deploy-smoke.md) · [`post-deploy-monitoring.md`](post-deploy-monitoring.md)

## Constraints honored

- Phase 3B Cash Flow preview-only UI deployed to production.
- Legacy Cash Flow default behavior unchanged.
- Loader swap not approved.
- Finance golden capture still required.
- BS/P&L finance status remains **PENDING**.
- R7/R8/next company remain blocked.
- No migrations, no flags, and no GL/data mutations.

## Post-deploy

- Three-company monitoring **PASS** after deploy
- Operator: hard refresh when validating preview UI (service worker)
