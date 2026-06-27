# R3 production deploy notes

**Date:** 2026-06-27  
**Deploy script:** `scripts/single-core-ledger/deploy-phase-r3-production-frontend-vps.sh`  
**Scope:** Frontend rebuild only — R3 audit scripts + R5 preflight docs on VPS repo. **No flag SQL.**

---

## Deploy record

| Field | Value |
|-------|-------|
| BUILD_LABEL | `phase-r3-prod` |
| git HEAD (post-pull) | _filled after deploy_ |
| Other-company loader flags | Must remain **0** |
| DIN CHINA unified flags | Must remain **12 ON** |

---

## Post-deploy verification

- [ ] `r3-readonly-expansion-audit.sql` present on VPS
- [ ] Flag audit PASS (0 other-company loaders)
- [ ] ERP frontend healthy @ https://erp.dincouture.pk

---

## Rollback

Docker tag `erp-frontend:rollback-before-r3-*` created at deploy start.
