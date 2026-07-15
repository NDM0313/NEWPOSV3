# Test changes

| Change | Detail |
|--------|--------|
| Added | `src/app/lib/r8R2LegacyMainRetired.test.ts` (5 tests) |
| Updated | `unifiedLedgerCompareScopeGuard.test.ts` — LV2 unified-main wiring |
| package.json | include new test in `test:unified-ledger` |
| Removed tests | none |
| Resolver / kill / flag / shadow / AR/AP tests | retained |

## Counts

| Suite | Baseline (main readiness) | Post-rehearsal |
|-------|---------------------------|----------------|
| unified-ledger | 343 | **348** (+5) |
| unit | 183 | **183** |
| build | PASS | PASS |
