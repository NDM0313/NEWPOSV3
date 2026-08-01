# Test changes

## Added

- `src/app/lib/r8R2LegacyMainRetired.test.ts` (5 tests)
  - assertUnified allows unified / rejects legacy
  - thin wrappers deleted on disk
  - pages assert unified + no deleted imports
  - shadow services retained, no LegacyMainService imports
  - BS/P&L still reference legacy fallback

## Updated

- `src/app/lib/unifiedLedgerCompareScopeGuard.test.ts` — LV2 page must not `await getLedgerStatementV2(`; shadow retains it
- `package.json` `test:unified-ledger` — includes `r8R2LegacyMainRetired.test.ts`

## Removed

- None (no meaningful tests deleted to achieve PASS)

## Counts

| Suite | Baseline (tag) | Post-deletion |
|-------|----------------|---------------|
| test:unified-ledger | 345/345 | 350/350 |
| test:unit | 188/188 | 188/188 |
