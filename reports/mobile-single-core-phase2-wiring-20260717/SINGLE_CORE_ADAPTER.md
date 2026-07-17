# SINGLE_CORE_ADAPTER.md

## Location

`erp-mobile-app/src/api/singleCore/`

| File | Role |
|------|------|
| `pure.ts` | Scope, error normalize, D/C mapping, Roznamcha mapping, loader metadata (node-test safe) |
| `index.ts` | `resolveSingleCoreLoader`, `loadPartyLedger`, `loadAccountLedger`, `loadTrialBalance`, `loadCashBankLedger`, `loadRoznamcha` |
| `accountingCache.ts` | Epoch bump, company cache invalidation, logout clear |
| `singleCore.test.ts` | Unit coverage for flags/scope/mapping/fail-loud contracts |

## Behaviour

- Unified only when engine + loader + screen flags ON and kill switch OFF.
- Failures return typed `SingleCoreError`; never coerce to successful empty/zero.
- Empty success uses `meta.resultKind = 'empty'` with `error = null`.
- Canonical fields preserved: company/branch, party/account ids, JE/line ids, debit/credit, opening/running/closing, basis, loader source.
