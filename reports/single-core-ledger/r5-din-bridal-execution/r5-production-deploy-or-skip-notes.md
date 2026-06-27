# R5 production deploy or skip notes

**Date:** 2026-06-27  
**Run:** R5 DIN BRIDAL CONTINUATION FROM GOLDEN CAPTURE  
**Status:** Loaders ON — deploy skipped

## Decision

**Deploy skipped.** Production mutation is DIN BRIDAL feature flags only. Unified loader frontend code was deployed at R5a (`11878c66`). No new `src/` runtime changes in this run.

| Item | Value |
|------|-------|
| Rollback tag | `erp-frontend:rollback-before-r5a-20260627101510` |
| Flag rollback | `scripts/single-core-ledger/din-bridal/r5-rollback-*.sql` |
