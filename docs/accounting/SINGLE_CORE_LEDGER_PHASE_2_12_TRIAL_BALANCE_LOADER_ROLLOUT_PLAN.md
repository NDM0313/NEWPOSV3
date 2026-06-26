# Phase 2.12 — Trial Balance unified loader rollout plan

**Company:** DIN CHINA only (`30bd8592-3384-4f34-899a-f3907e336485`)  
**Scope:** Trial Balance main loader swap only  
**No migrations. No GL mutation.**

## Flags

| Flag | Role |
|------|------|
| `unified_ledger_loader_trial_balance` | L1 — unified main when ON |
| `unified_ledger_screen_trial_balance` | Screen gate |

## Resolver order

1. Kill switch → legacy  
2. Loader OFF/absent → legacy  
3. Engine OFF → legacy  
4. Screen OFF → legacy  
5. All gates ON → unified  

## Rollback

- **L1:** loader flag OFF  
- **L2:** screen flag OFF  
- **L3:** engine OFF  
- **L4:** kill switch  

## Unchanged

- Ledger V2 loader (`unified_ledger_loader_ledger_v2`)  
- Account Statement loader (`unified_ledger_loader_account_statement`)  
- Roznamcha, Party Ledger, Cash/Bank flags  

## Evidence

`reports/single-core-ledger/phase-2-12-trial-balance-loader/`
