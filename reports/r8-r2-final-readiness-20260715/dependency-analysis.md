# Dependency and Build Impact Analysis

Inspected: imports, page usage, shadow, tests, dashboards, mobile. No code deleted.

## Candidate dependency table

| Candidate | Direct refs | Indirect refs | Shared consumers | Safe after soak | Risk |
|-----------|-------------|-----------------|------------------|-----------------|------|
| `accountStatementLegacyMainService.ts` | AccountLedgerReportPage; accountStatementLegacyShadowPreviewService | AS resolver returns `legacy` → page branch | Shadow (must retarget) | YES if drill PASS + same-PR retarget | MEDIUM |
| `trialBalanceLegacyMainService.ts` | TrialBalancePage; trialBalanceLegacyShadowPreviewService | TB resolver | Shadow; **not** dashboard `getTrialBalance` (deeper API) | YES with page+shadow PR | MEDIUM |
| `partyLedgerLegacyMainService.ts` | EffectivePartyLedgerPage; partyLedgerLegacyShadowPreviewService | Party resolver | Shadow | YES with PR | MEDIUM |
| `roznamchaLegacyMainService.ts` | RoznamchaReport; roznamchaLegacyShadowPreviewService | Roznamcha resolver; CF shadow coupling possible | Shadow | YES with PR | MEDIUM |
| Ledger V2 page legacy branch | LedgerStatementCenterV2Page | `getLedgerStatementV2` elsewhere (hybrid/preview) | Hybrid `getCustomerLedger` | Page branch YES; **do not** delete `getLedgerStatementV2` service | HIGH if service deleted |
| Cash Flow page `getCashFlowReport` branch | CashFlowReportPage | Mobile may use related APIs | Shared CF report service | Branch YES; keep service | HIGH pre-drill |
| BS/P&L error fallback | BalanceSheetPage / ProfitLossPage | Dashboard BS/P&L loads | Shared report services | Page fallback removable last | HIGH |
| Shadow services | Preview panels / Admin Compare | Monitoring | Diagnostics | **Not safe to delete** | N/A retain |
| Resolvers / flags / kill | All screens | Tests 100+ | Entire dual-loader system | **Not safe to delete** | N/A retain |
| Rollback SQL | Ops runbooks | Loader guard tests | L1 | **Not safe to delete** | N/A retain |

## Classifications found

| Type | Examples |
|------|----------|
| Dead code (candidate post-soak) | Thin Main wrappers **after** page branches + shadow retarget |
| Active code | Page legacy branches while kill/flag can return `legacy` |
| Rollback-only | L1 SQL; kill switch; resolvers |
| Shared reusable | `getTrialBalance`, BS/P&L report APIs, `getCashFlowReport` service |
| Misleading filenames | `DashboardLegacy.tsx`, printer Legacy* — **not** SCE loader legacy |

## Build impact (future deletion PR)

1. TypeScript: failing imports until shadow/pages updated.
2. Tests: page wiring asserting LegacyMain import paths must update; resolver `legacy` source tests **remain**.
3. Runtime: with flags ON and kill OFF, user screens unchanged if only dead legacy branch removed.
4. Kill ON after deletion: **without** page legacy branch, screens fail closed unless L1 flags alone used for rollback (preferred) — this is why **operator drill before delete** is mandatory.
5. Mobile / Contacts / Play Store: no impact if scoped correctly.

## Safe-after-soak definition

`Safe after soak` = date gate met **and** fresh kill-switch drill PASS **and** three-company monitoring PASS **and** approval phrase recorded **and** PR limited to section A candidates + shadow retarget + tests/docs.
