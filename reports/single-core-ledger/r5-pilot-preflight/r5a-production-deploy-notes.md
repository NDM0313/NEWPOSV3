# R5a production deploy notes

**Date:** 2026-06-27  
**Deploy script:** `scripts/single-core-ledger/deploy-phase-r5a-production-frontend-vps.sh`  
**Scope:** Frontend rebuild + R5a toolkit on VPS. **No flag SQL.**

---

## Deploy record

| Field | Value |
|-------|-------|
| BUILD_LABEL | `phase-r5a-prod` |
| git HEAD (post-pull) | _filled after deploy_ |
| DIN CHINA unified flags ON | Must be **12** |
| DIN BRIDAL unified flags ON | Must be **0** |
| Other-company loaders | Must be **0** |

---

## Post-deploy verification

- [ ] `r5-company-config.json` on VPS
- [ ] `din-bridal/r5-preflight-flags.sql` on VPS
- [ ] Flag audit PASS
- [ ] ERP @ https://erp.dincouture.pk healthy

---

## Rollback

Docker tag `erp-frontend:rollback-before-r5a-*` created at deploy start.
