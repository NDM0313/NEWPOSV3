# PRE_EXISTING_WIP.md / WIP_PORT_DECISIONS.md

**Main tree preserved at:** `/Users/ndm/Documents/Development/CursorDev/NEWPOSV3` (branch `main`, dirty)  
**Feature worktree:** `/Users/ndm/Documents/Development/CursorDev/NEWPOSV3-mobile-sc-phase2` (`feature/mobile-single-core-party-roznamcha`, clean at `812c2871`)

## Preservation method

Git worktree from `origin/main`. Main working tree untouched (no reset/clean/checkout).

## Classification

| Path | Decision |
|------|----------|
| `erp-mobile-app/src/api/partyGlLedger.ts` | **PORT** — empty-success helper + hardened parse |
| `erp-mobile-app/src/api/unifiedLedgerRpc.ts` | **PORT** — openingBalance + null all-time dates |
| `erp-mobile-app/src/api/accounts.ts` | **PORT** — `overlayAccountBalancesFromJournal` |
| `erp-mobile-app/src/components/accounts/reports/AccountLedgerReport.tsx` | **PORT** — empty-success JE fallback, All-time default, journal list balances |
| `erp-mobile-app/src/components/accounts/reports/PartyLedgerReport.tsx` | **PORT then EXTEND** — fallback policy + All-time; then unified wiring |
| `erp-mobile-app/src/components/accounts/reports/_shared/LedgerPeriodEmptyCard.tsx` | **PORT** |
| `erp-mobile-app/src/components/accounts/reports/_shared/index.ts` | **PORT** exports |
| `erp-mobile-app/src/components/shared/AttachmentIndicatorButton.tsx` | **PORT** — nested button fix |
| `erp-mobile-app/src/lib/loadMergedAttachments.ts` | **SKIP unless needed** — verify diff first |
| graphify / releases / monitoring JSON / R8 docs | **DO NOT PORT** — artifacts |
| Phase1 reports under `reports/mobile-single-core-alignment-20260717/` | Copy into phase2 evidence as reference only |
