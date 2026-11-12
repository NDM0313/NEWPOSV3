# Production deploy safety snapshot — Phase 3A-PROD

**Run:** PHASE 3A-PROD — DEPLOY BS/P&L PREVIEW-ONLY UI  
**Captured:** 2026-06-29  
**Operator approval:** Deploy Phase 3A preview-only UI to production

## Git checks

| Check | Result |
|-------|--------|
| Branch | `main` |
| HEAD / origin | `4a5dc304` — feat(accounting): add BS and P&L unified preview parity |
| Staged at start | NONE |
| Phase 3A on origin/main | YES |

## Excluded local dirty (not touched)

- `graphify-out/GRAPH_REPORT.md`
- DIN BRIDAL golden-fixtures.*, golden-capture/*, production flags/report
- `latest-three-company-monitoring.*`
- `three-company-monitoring-2026-06-29T09-06-51-058Z.*`
- DIN COUTURE / phase-2-16 timestamp refresh files
- `final-office-pc-local-status.*`

## Deploy scope lock

- Frontend only: `deploy/vps-build-erp-only.sh`
- Target: https://erp.dincouture.pk
- No migrations · No flag changes · No GL mutation
