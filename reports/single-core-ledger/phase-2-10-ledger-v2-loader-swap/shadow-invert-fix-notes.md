# Phase 2.10C-FIX — Legacy shadow compare for unified main loader

**Status:** `PHASE 2.10C-FIX PASS — candidate QA clean; ready for controlled loader soak approval`  
**Timestamp (UTC):** 2026-06-26  
**Build:** `phase-210c-fix` on `erp-frontend-preview` :3003 only  
**Production:** `erp.dincouture.pk` **not touched**

## Waiver fixed

| Before (2.10C) | After (2.10C-FIX) |
|----------------|-------------------|
| Main unified → preview loaded unified RPC (unified vs unified golden) | Main unified → preview loads **legacy shadow** via `loadLedgerV2LegacyShadowPreview` |
| `data-ledger-v2-preview-compare-source` absent | `legacy_shadow` when main unified; `unified_compare` when main legacy |

## Code changes

| File | Change |
|------|--------|
| `src/app/lib/resolveLedgerV2PreviewCompareSource.ts` | Compare source resolver + row mapping + labels |
| `src/app/services/ledgerStatementCenterV2LegacyShadowPreviewService.ts` | Legacy shadow loader (`getLedgerStatementV2`) |
| `LedgerStatementCenterV2Page.tsx` | Inverted `loadPreviewCompare` by `mainLoaderSource` |
| `LedgerV2UnifiedPreviewPanel.tsx` | Dynamic labels + `data-ledger-v2-preview-compare-source` |
| `resolveLedgerV2PreviewCompareSource.test.ts` | 8 new unit tests |
| `run-phase-210-loader-browser-qa.mjs` | Asserts `legacy_shadow` / `unified_compare` |

## Behavior matrix

| Loader flag | Main table | Preview toggle ON |
|-------------|------------|-------------------|
| OFF | Legacy (`getLedgerStatementV2`) | Unified RPC compare (`unified_compare`) |
| ON | Unified (`getLedgerStatementV2UnifiedMain`) | Legacy shadow compare (`legacy_shadow`) |
| L1 rollback OFF | Legacy restored | Unified compare restored |

Exports always use active main `result.rows` — unchanged.

## Verification

| Gate | Result |
|------|--------|
| `npm run test:unified-ledger` | **155/155 PASS** |
| `npm run build` | **PASS** |
| Preview bundle | `data-ledger-v2-preview-compare-source` **FOUND** |
| Candidate rerun QA | **PASS** — `legacy_shadow`, MR JALIL PKR 216,300, Pilot 9/9 |
| Candidate export rerun | **SIGNED** — PDF/Excel/CSV PKR 216,300 |
| L1 rollback + rollback QA | **PASS** — `unified_compare` restored |

## DB window (rolled back)

Loader flag enabled for candidate rerun only; L1 rollback applied @ 2026-06-26 post-rerun. Current state: `unified_ledger_loader_ledger_v2 = false` for DIN CHINA.

## Remaining waiver

Staff preview toggle visibility — no staff credentials (same as 2.10B/2.10C).
