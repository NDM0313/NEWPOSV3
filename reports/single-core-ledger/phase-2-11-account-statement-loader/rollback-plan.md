# Phase 2.11 — rollback plan

## L1 (loader OFF — first response)

`scripts/single-core-ledger/phase-211-rollback-account-statement-loader.sql`

Expected: `data-account-statement-main-loader="legacy"`, preview `unified_compare`.

## L2 (screen OFF)

`scripts/single-core-ledger/phase-211-rollback-account-statement-screen.sql`

## L3 (engine OFF — DIN CHINA all unified screens)

Disable `unified_ledger_engine` for company (existing runbook).

## L4 (kill switch)

Global env / DB kill switch per unified ledger runbook.

## Frontend rollback

Preview: `erp-frontend-preview:rollback-before-211-*`  
Production: `erp-frontend:rollback-before-211-*`
