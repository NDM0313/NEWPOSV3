# R8 legacy retirement plan

**Status:** `BLOCKED_PENDING_STABLE_RUN_AND_FINAL_APPROVAL`  
**Generated:** 2026-06-30

## Prerequisites

- **2–4 weeks** stable three-company monitoring PASS (Admin Compare 9/9)
- All approved unified **main** loaders live (Cash Flow done; BS/P&L pending finance)
- Backup git tag before any retirement commit
- Written operator approval

## Likely deprecation candidates (future)

- Legacy-only party ledger paths used only for Admin Compare shadow
- Duplicate service shims superseded by unified mappers
- Historical repair SQL (archive to `scripts/sql/archive/`, do not delete in R8)

## Pre-retirement scans

```bash
# Example — run before any removal PR
rg "getCustomerLedger|legacy_shadow|hybrid" src/ erp-mobile-app/
rg "unified_ledger_loader" src/app/config/
```

## Rollback requirement

- Feature flags OFF restores legacy main loaders
- Deploy revert to tagged release
- No DB migrations in R8 retirement phase

## Do not execute

No engine deletion, no import removal, no deploy in this run.
