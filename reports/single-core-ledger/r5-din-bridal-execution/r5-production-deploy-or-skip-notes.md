# R5 production deploy or skip notes

**Date:** 2026-06-27  
**Run:** R5 DIN BRIDAL ACCELERATED SOAK WAIVER + FINAL COMPLETION  
**Status:** R5 COMPLETE

## Decision

**Deploy skipped.** Production change is feature flags only. Unified loader frontend shipped at R5a (`11878c66`). No new runtime files in completion run.

| Item | Value |
|------|-------|
| Rollback tag | `erp-frontend:rollback-before-r5a-20260627101510` |
| Flag rollback | `scripts/single-core-ledger/din-bridal/r5-rollback-*.sql` |
