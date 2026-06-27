# Phase 2.13 — Party Ledger loader inventory

## Page / component

| Item | Path |
|------|------|
| Main page | `src/app/components/accounting/EffectivePartyLedgerPage.tsx` |
| Preview panel | `src/app/components/accounting/PartyLedgerUnifiedPreviewPanel.tsx` |
| Navigation | `Sidebar.tsx` → `party-ledger` view |

## Loaders

| Role | Service | RPC / source |
|------|---------|--------------|
| Legacy main | `partyLedgerLegacyMainService.ts` → `loadEffectivePartyLedger` | Client-side collapse |
| Unified main | `partyLedgerUnifiedMainService.ts` → `getUnifiedPartyLedger` | `shadowForce: false` |
| Unified preview compare | `partyLedgerUnifiedPreviewService.ts` | `shadowForce: true` |
| Legacy shadow preview | `partyLedgerLegacyShadowPreviewService.ts` | Legacy when main unified |

## Resolvers

| File | Purpose |
|------|---------|
| `resolvePartyLedgerMainLoaderSource.ts` | Main loader gate |
| `resolvePartyLedgerPreviewCompareSource.ts` | Preview invert + compare args |

## Mapper

| File | Purpose |
|------|---------|
| `partyLedgerUnifiedMainMapper.ts` | Unified rows → `EffectiveLedgerResult` |
| `partyLedgerUnifiedMapper.ts` | Preview row shape (unchanged) |

## Export / share

- No on-page PDF/Excel/CSV on Party Ledger (directs users to Account Statements)
- Preview JSON export via `PartyLedgerUnifiedPreviewPanel` compare diff

## Filters

- Date range: page-local + global filters
- Branch: legacy ignores branch; unified RPC uses all branches (`partyLedgerPreviewBranchScope`)
- Mode: effective / audit; showReversals toggles basis

## Role gates

- Unified preview tools: admin/developer via `canAccessPartyLedgerUnifiedPreview`

## Tests added

- `resolvePartyLedgerMainLoaderSource.test.ts`
- `resolvePartyLedgerPreviewCompareSource.test.ts`
- `partyLedgerMainLoaderExportParity.test.ts`
