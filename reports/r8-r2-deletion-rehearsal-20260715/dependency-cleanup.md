# Dependency cleanup

## Shadow retarget (human decision D1 executed)

Legacy bodies for thin wrappers moved into corresponding `*LegacyShadowPreviewService.ts`:

| Deleted wrapper | Shadow now calls |
|-----------------|------------------|
| accountStatementLegacyMainService | underlying AS legacy APIs / `getCustomerLedger` path |
| trialBalanceLegacyMainService | `getTrialBalance` |
| partyLedgerLegacyMainService | `loadEffectivePartyLedger` |
| roznamchaLegacyMainService | `getRoznamcha` |

## Import cleanup only

- Removed page imports of deleted wrappers
- Removed LV2 page import of `getLedgerStatementV2` (retained in shadow service)
- Removed Roznamcha legacy-only result cache (served only legacy main path)

## Not done (out of scope)

- No broad service renames
- No Contacts / mobile / AR/AP basis / account code changes
- No migration / rollback SQL mutation
- No kill-switch production toggle

## Build errors from deletion

None after surgical rebase onto `9f0e237a` (LV2 pagination + Cash Flow pagination preserved).
