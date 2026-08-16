# Phase 2.12 — rollback plan

## Triggers

- Trial Balance crash  
- total debit ≠ total credit  
- unified totals ≠ legacy golden  
- export ≠ on-screen  
- Ledger V2 or Account Statement behavior change  
- MR JALIL ≠ PKR 216,300  
- Pilot Batch ≠ 9/9  

## Levels

**L1** — `phase-212-rollback-trial-balance-loader.sql`  
**L2** — `phase-212-rollback-trial-balance-screen.sql`  
**L3** — engine OFF (existing 29c rollback)  
**L4** — kill switch  

After L1: Trial Balance main returns legacy; screen flag may remain ON for preview tools.
