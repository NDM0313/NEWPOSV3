# R5a production deploy notes

**Date:** 2026-06-27  
**Deploy script:** `scripts/single-core-ledger/deploy-phase-r5a-production-frontend-vps.sh`  
**Scope:** Frontend rebuild + R5a toolkit on VPS. **No flag SQL.**

---

## Deploy record

| Field | Value |
|-------|-------|
| BUILD_LABEL | `phase-r5a-prod` |
| git HEAD (post-pull) | `11878c66` |
| Rollback tag | `erp-frontend:rollback-before-r5a-20260627101510` |
| DIN CHINA unified flags ON | **12** (PASS) |
| DIN BRIDAL unified flags ON | **0** (PASS) |
| Other-company loaders | **0** (PASS) |
| ERP URL | https://erp.dincouture.pk |

---

## Post-deploy verification

- [x] `r5-company-config.json` on VPS
- [x] `din-bridal/r5-preflight-flags.sql` on VPS
- [x] Flag audit PASS
- [x] `erp-frontend` container recreated and started

---

## Rollback

```bash
docker tag erp-frontend:rollback-before-r5a-20260627101510 erp-frontend:latest
docker compose -f deploy/docker-compose.prod.yml --env-file .env.production up -d --force-recreate erp
```

---

## Notes

R5 flag enablement **not executed**. Finance sign-off still required before `din-bridal/r5-enable-*.sql`.
