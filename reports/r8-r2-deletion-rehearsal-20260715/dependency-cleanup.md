# Dependency cleanup

## Shadow retarget

| Shadow service | Previously | Now |
|----------------|------------|-----|
| accountStatementLegacyShadowPreviewService | `loadAccountStatementLegacyMain` | inlined `getCustomerLedger` / AP / worker / account ledger |
| trialBalanceLegacyShadowPreviewService | `loadTrialBalanceLegacyMain` | `accountingReportsService.getTrialBalance` |
| partyLedgerLegacyShadowPreviewService | `loadPartyLedgerLegacyMain` | `loadEffectivePartyLedger` |
| roznamchaLegacyShadowPreviewService | `loadRoznamchaLegacyMain` | `getRoznamcha` |

## Page fail-closed

When kill/flags resolve to `legacy`, pages throw `R8_R2_LEGACY_MAIN_RETIRED_MESSAGE`.
Production recovery after merge requires **L2 tag restore** (or keep this rehearsal unmerged until drill proves ops path).

## Shared consumers unchanged

Dashboards → `getTrialBalance` / BS / P&L report services (not deleted wrappers).
Cash Flow preview → `getCashFlowReport` still imported.
Ledger V2 shadow → `getLedgerStatementV2` still used outside page main path.
