# R3 production deploy notes

**Date:** 2026-06-27  
**Deploy script:** `scripts/single-core-ledger/deploy-phase-r3-production-frontend-vps.sh`  
**Scope:** Frontend rebuild only — R3 audit scripts + R5 preflight docs on VPS repo. **No flag SQL.**

---

## Deploy record

| Field | Value |
|-------|-------|
| BUILD_LABEL | `phase-r3-prod` |
| git HEAD (post-pull) | `36c6d22b` |
| Rollback tag | `erp-frontend:rollback-before-r3-20260627095553` |
| Other-company loader flags | **0** (PASS) |
| DIN CHINA unified flags | **12 ON** (PASS) |
| R3 audit scripts on VPS | Present |
| ERP URL | https://erp.dincouture.pk |

---

## Post-deploy verification

- [x] `r3-readonly-expansion-audit.sql` present on VPS
- [x] Flag audit PASS (0 other-company loaders)
- [x] `erp-frontend` container recreated and started

---

## Rollback

```bash
docker tag erp-frontend:rollback-before-r3-20260627095553 erp-frontend:latest
docker compose -f deploy/docker-compose.prod.yml --env-file .env.production up -d --force-recreate erp
```

---

## Notes

R5 pilot flag enablement **not executed** — finance sign-off still required.
