# Phase 2.13 — Party Ledger unified loader rollout plan

**Company:** DIN CHINA only (`30bd8592-3384-4f34-899a-f3907e336485`)  
**Screen:** Party Ledger only  
**Status:** `PHASE 2.13 PARTY LEDGER LOADER ON PASS — unified main live for DIN CHINA`  
**Baseline:** Phase 2.12X closeout — Ledger V2, Account Statement, Trial Balance unified main live

## Scope confirmation

| Constraint | Status |
|------------|--------|
| No migrations | Confirmed — flag-only rollout |
| No GL mutation | Confirmed — read-only loader swap |
| DIN CHINA only | Confirmed — SQL targets single company_id |
| Party Ledger only | Confirmed — new loader + screen flags only |
| LV2 / AS / TB loaders unchanged | Confirmed — separate resolver keys |
| Roznamcha / Cash-Bank not enabled | Confirmed — not in Phase 2.13 keys |

## New flags

| Flag | Purpose |
|------|---------|
| `unified_ledger_screen_party_ledger` | Screen gate (L2 rollback) |
| `unified_ledger_loader_party_ledger` | Main loader swap (L1 rollback) |

## Loader decision order

1. Kill switch active → legacy  
2. Loader flag OFF/absent → legacy  
3. Engine OFF → legacy  
4. Screen party ledger OFF → legacy  
5. All gates ON → unified main (`shadowForce: false`)

## Preview compare inversion

| Main loader | Preview compare source |
|-------------|------------------------|
| legacy | `unified_compare` |
| unified | `legacy_shadow` |

## QA attributes

- `data-party-ledger-main-loader="legacy"|"unified"`
- `data-party-ledger-preview-compare-source="unified_compare"|"legacy_shadow"`

## Rollback levels

| Level | Action |
|-------|--------|
| L1 | `unified_ledger_loader_party_ledger` OFF |
| L2 | `unified_ledger_screen_party_ledger` OFF |
| L3 | `unified_ledger_engine` OFF |
| L4 | Kill switch |

## Golden gates

- MR JALIL Party Ledger closing = legacy golden (expected PKR 216,300 if basis aligns)
- Ledger V2 MR JALIL = PKR 216,300
- Account Statement MR JALIL = PKR 216,300
- Trial Balance debit = credit = PKR 407,957,271.02
- Admin Compare Pilot Batch = 9/9

## Preview deploy waiver

Same as Phase 2.12: preview tunnel cannot isolate JS bundle (lazy chunks load from production CDN). Proceed with production-safe baseline pattern.

## Evidence pack

`reports/single-core-ledger/phase-2-13-party-ledger-loader/`

## SQL artifacts

`scripts/single-core-ledger/phase-213-*.sql`

## Implementation files

- `resolvePartyLedgerMainLoaderSource.ts`
- `resolvePartyLedgerPreviewCompareSource.ts`
- `partyLedgerLegacyMainService.ts` / `partyLedgerUnifiedMainService.ts` / `partyLedgerLegacyShadowPreviewService.ts`
- `partyLedgerUnifiedMainMapper.ts`
- `EffectivePartyLedgerPage.tsx` wiring
