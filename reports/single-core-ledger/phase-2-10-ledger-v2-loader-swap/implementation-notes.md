# Phase 2.10A — Implementation notes

**Status:** `PHASE 2.10B PREVIEW BASELINE QA PASS — ready for loader-flag candidate approval`  
**Date:** 2026-06-14  
**Scope:** Code + tests + SQL artifacts only — **loader flag NOT enabled**

## Code changes

| File | Change |
|------|--------|
| `src/app/lib/unifiedLedgerFlagKeys.ts` | Added `LOADER_LEDGER_V2: unified_ledger_loader_ledger_v2` |
| `src/app/lib/resolveLedgerV2MainLoaderSource.ts` | New resolver — outputs `legacy` \| `unified` \| `killed` |
| `src/app/services/ledgerStatementCenterV2UnifiedFetch.ts` | Shared unified RPC fetch (preview + main) |
| `src/app/services/ledgerStatementCenterV2UnifiedMainService.ts` | Main loader service (`shadowForce: false`) |
| `src/app/services/ledgerStatementCenterV2UnifiedPreviewService.ts` | Refactored to use shared fetch (`shadowForce: true`) |
| `src/app/features/ledger-statement-center-v2/LedgerStatementCenterV2Page.tsx` | Branch `loadStatement`; invert preview compare when main is unified; `data-ledger-v2-main-loader` |

## Loader decision (implemented)

1. Kill switch → legacy (`killed` → effective legacy)
2. `unified_ledger_loader_ledger_v2` OFF/absent → legacy
3. `unified_ledger_engine` OFF → legacy
4. `unified_ledger_screen_ledger_v2` OFF → legacy
5. All gates ON → unified main loader

## Production behavior today

- Loader flag SQL **not run** — main table remains **legacy** for DIN CHINA.
- Engine + screen flags unchanged from Phase 2.9C Stage 2.
- Preview toggle behavior preserved; when loader flag is later enabled, preview inverts to legacy shadow compare.

## Rollback layers

| Level | Action |
|-------|--------|
| L1 | `phase-210-rollback-loader-ledger-v2.sql` — loader flag OFF |
| L2 | `phase-29c-rollback-screen-ledger-v2.sql` |
| L3 | `phase-29c-rollback-engine.sql` |
| L4 | Kill switch ON |

## Export parity

PDF/Excel/CSV/WhatsApp derive from `result.rows` / `summary` in `LedgerStatementCenterV2Page`. No separate export path. **Signed export spot-check required before candidate-mode QA.**

## Not executed

- Loader enable SQL
- Migrations
- Production deploy
- Candidate browser QA (requires loader flag ON in preview/staging)
