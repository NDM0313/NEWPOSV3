# Deletion files (rehearsal)

**Branch:** `rehearsal/r8-r2-legacy-deletion-20260715`  
**Commit:** `c660f5c3` (rebased onto `9f0e237a`)

## A1. Thin wrappers deleted

| File | Status |
|------|--------|
| `src/app/services/accountStatementLegacyMainService.ts` | DELETED |
| `src/app/services/trialBalanceLegacyMainService.ts` | DELETED |
| `src/app/services/partyLedgerLegacyMainService.ts` | DELETED |
| `src/app/services/roznamchaLegacyMainService.ts` | DELETED |

## A2. Page legacy branches removed (unified-only + fail-closed)

| Page | Change |
|------|--------|
| `AccountLedgerReportPage.tsx` | Removed `loadAccountStatementLegacyMain` branch; `assertUnifiedMainLoaderSource` |
| `TrialBalancePage.tsx` | Removed `loadTrialBalanceLegacyMain` branch; assert |
| `EffectivePartyLedgerPage.tsx` | Removed `loadPartyLedgerLegacyMain` branch; assert |
| `RoznamchaReport.tsx` | Removed `loadRoznamchaLegacyMain` branch + legacy-only cache; assert |
| `LedgerStatementCenterV2Page.tsx` | Removed `getLedgerStatementV2` main branch; assert; **pagination retained** |
| `CashFlowReportPage.tsx` | Removed `getCashFlowReport` main branch; assert; shadow still uses `getCashFlowReport` |

## Supporting

| File | Change |
|------|--------|
| `r8R2LegacyMainRetired.ts` | NEW — fail-closed helper |
| `r8R2LegacyMainRetired.test.ts` | NEW — wiring + retention assertions |
| `*LegacyShadowPreviewService.ts` (×4) | Retargeted to underlying APIs |
| `unifiedLedgerCompareScopeGuard.test.ts` | Asserts LV2 no longer calls `getLedgerStatementV2` on page |
| `package.json` | Adds `r8R2LegacyMainRetired.test.ts` to `test:unified-ledger` |
