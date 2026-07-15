# Deletion files (rehearsal)

## Deleted files

| Path | Classification |
|------|----------------|
| `src/app/services/accountStatementLegacyMainService.ts` | approved thin wrapper |
| `src/app/services/trialBalanceLegacyMainService.ts` | approved thin wrapper |
| `src/app/services/partyLedgerLegacyMainService.ts` | approved thin wrapper |
| `src/app/services/roznamchaLegacyMainService.ts` | approved thin wrapper |

## Page branches removed (files retained)

| Page | Change |
|------|--------|
| `AccountLedgerReportPage.tsx` | unified-only main; `assertUnifiedMainLoaderSource` |
| `TrialBalancePage.tsx` | same |
| `EffectivePartyLedgerPage.tsx` | same |
| `RoznamchaReport.tsx` | same; removed legacy-only result cache |
| `LedgerStatementCenterV2Page.tsx` | removed `getLedgerStatementV2` main branch |
| `CashFlowReportPage.tsx` | removed `getCashFlowReport` main branch (preview still uses it) |

## Added

| Path | Role |
|------|------|
| `src/app/lib/r8R2LegacyMainRetired.ts` | fail-closed helper when resolver=`legacy` |
| `src/app/lib/r8R2LegacyMainRetired.test.ts` | wiring / retain assertions |
