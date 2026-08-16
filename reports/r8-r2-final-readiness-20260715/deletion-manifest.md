# Exact Future R8-R2 Deletion Manifest

**Execution earliest:** 2026-08-09
**Approval phrase:** `R8_R2_CODE_DELETION_APPROVAL_REQUIRED`
**No deletions performed:** 2026-07-15

---

## A. Approved future deletion candidates

### A1. Thin wrappers (file delete)

| File | Imports to remove / retarget | Page branches | Tests | Exports | After deletion | Rollback dep | Deploy | Risk |
|------|------------------------------|---------------|-------|---------|----------------|--------------|--------|------|
| `src/app/services/accountStatementLegacyMainService.ts` | Page + **shadow** must stop importing; shadow retargets to underlying AS legacy API body | AS legacy branch | Update AS wiring if import path asserted | Drop export | Kill→unified only via flag OFF using deeper APIs **or** kill leaves unresolved — **must** keep kill path via inline call to same body in page until branch removed in same PR | phase-211 | frontend | **MEDIUM** — coordinate with shadow |
| `src/app/services/trialBalanceLegacyMainService.ts` | Page + shadow | TB branch | TB wiring | Drop | Same | phase-212 | frontend | MEDIUM |
| `src/app/services/partyLedgerLegacyMainService.ts` | Page + shadow | Party branch | Party wiring | Drop | Same | phase-213 | frontend | MEDIUM |
| `src/app/services/roznamchaLegacyMainService.ts` | Page + shadow | Roznamcha branch | Roznamcha wiring | Drop | Same | phase-214 | frontend | MEDIUM |

**Rule:** In one PR: delete wrappers **and** page branches that call them **and** retarget shadow imports. Do not leave broken imports.

### A2. Page legacy branches (code-path delete, retain files)

| Location | What to remove | Expected behavior after | Risk |
|----------|----------------|-------------------------|------|
| `LedgerStatementCenterV2Page.tsx` | Branch calling `getLedgerStatementV2` when resolver=`legacy` | Force unified-only when flags ON; when flags OFF page errors or no-load (acceptable **after** drill proves L1 flag rollback sufficient without in-page legacy) | **HIGH** if done before drill |
| `AccountLedgerReportPage.tsx` | `loadAccountStatementLegacyMain` branch | Unified-only main | HIGH pre-drill |
| `TrialBalancePage.tsx` | `loadTrialBalanceLegacyMain` branch | Unified-only; dashboards unaffected | HIGH pre-drill |
| `EffectivePartyLedgerPage.tsx` | `loadPartyLedgerLegacyMain` branch | Unified-only | HIGH pre-drill |
| `RoznamchaReport.tsx` | `loadRoznamchaLegacyMain` branch | Unified-only | HIGH pre-drill |
| `CashFlowReportPage.tsx` | `getCashFlowReport` legacy main branch | Unified-only main | HIGH pre-drill |

### A3. Later wave (same R8-R2 session only if drill PASS + operator confirms)

| Location | Action | Risk |
|----------|--------|------|
| `BalanceSheetPage.tsx` error→legacy catch | Remove fallback after kill/flag drill proves restore | **HIGH** |
| `ProfitLossPage.tsx` error→legacy catch | Same | **HIGH** |

If operator prefers minimal first deletion day: stop after A1+A2; leave BS/P&L fallback as **must-retain until separate mini-approval**.

---

## B. Must-retain files (not in deletion scope)

- All `*LegacyShadowPreviewService.ts` (×5)
- `getCustomerLedger` / hybrid paths in `accountingService.ts`
- Contacts page + `get_contact_party_gl_balances` callers
- Mobile `erp-mobile-app` legacy fallthrough
- All `resolve*MainLoaderSource.ts` (+ BS/P&L)
- `unifiedLedgerEngineState`, feature-flag libs, kill-switch wiring
- `scripts/single-core-ledger/**` rollback SQL (~36)
- Loader guard scripts / monitoring scripts
- Shared `getTrialBalance` / BS / P&L report service APIs used by dashboards
- AR/AP parity libs (`arApPartyGlParity.ts` etc.)
- L2 tags / deploy scripts

---

## C. Deferred outside-scope

- Contacts migration to unified party GL
- Mobile refactor / Play Store
- Phase 8 `getCustomerLedger` retirement
- Cashbook / import-gap / attachments WIP
- Graphify
- FX / multi-currency app
- `DashboardLegacy.tsx`, printer Legacy* (name-only)

---

## D. Human decision required

1. **Shadow retarget pattern** — inline underlying fetch vs keep thin private helper non-exported.
2. **BS/P&L fallback** — same day as A1–A2 vs follow-up after another soak window.
3. Whether **resolver tests** that assert `legacy` source remain (they should — kill/flag OFF still returns `legacy`; pages may no longer implement that branch → tests must assert resolver only, not page load).

---

## Explicitly excluded from deletion candidates

Shadow compare · `getCustomerLedger` · Contacts legacy RPC · mobile · resolvers · engine state · feature flags · loader guard · rollback SQL — **unless** future written scope expands (not this R8-R2).
