# R5 production deploy or skip notes

**Date:** 2026-06-27  
**Run:** R5 DIN BRIDAL FINANCE SIGN-OFF ARTIFACT + CONTROLLED ROLLOUT EXECUTION  
**Status:** BLOCKED at Step 4 (credentials) — no deploy

---

## Decision

**Deploy skipped.** No frontend or flag changes in this run. Finance sign-off artifact created; production flags unchanged.

| Item | Value |
|------|-------|
| Last successful deploy | R5a @ `11878c66` |
| Rollback tag | `erp-frontend:rollback-before-r5a-20260627101510` |
| Production URL | https://erp.dincouture.pk |
| Skip reason | Docs/sign-off/evidence only; no runtime or flag changes |
