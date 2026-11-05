# BS/P&L materials index

**Run:** OFFICE RESUME BS/P&L APPROVAL PACK — 2026-07-01  
**Mode:** Read-only review

## Phase 3D capture & finance packs

| Path | Role |
|------|------|
| `reports/single-core-ledger/phase-3d-bs-pl-golden-capture/finance-signoff-pack.md` | Primary finance review document |
| `reports/single-core-ledger/phase-3d-bs-pl-golden-capture/bs-pl-loader-swap-gate.md` | Gate checklist — all BLOCKED |
| `reports/single-core-ledger/phase-3d-bs-pl-golden-capture/balance-sheet-candidate-goldens.md` | Per-company BS candidate totals |
| `reports/single-core-ledger/phase-3d-bs-pl-golden-capture/profit-loss-candidate-goldens.md` | Per-company P&L candidate totals |
| `reports/single-core-ledger/phase-3d-bs-pl-golden-capture/diff-analysis.md` | 6/6 zero-diff summary |
| `reports/single-core-ledger/phase-3d-bs-pl-golden-capture/exports/` | JSON exports per company |
| `reports/single-core-ledger/phase-3d-bs-pl-golden-capture/screenshots/` | Preview compare screenshots |
| `reports/remaining-tasks-start-20260630/bs-pl-loader-swap-approval-pack.md` | Prior approval pack draft |

## Code / UI (preview-only today)

| Path | Role |
|------|------|
| `src/app/services/bsPlUnifiedPreviewService.ts` | Unified BS/P&L preview RPC service |
| `src/app/lib/accounting/balanceSheetUnifiedPreviewMapper.ts` | BS preview mapper |
| `src/app/lib/accounting/bsPlUnifiedPreviewDiff.ts` | Compare diff logic |
| `src/app/components/accounting/BalanceSheetUnifiedPreviewPanel.tsx` | BS preview compare panel |
| `src/app/components/reports/BalanceSheetPage.tsx` | Legacy main BS page |
| `src/app/components/reports/ReportsDashboardEnhanced.tsx` | P&L / BS report routing |

## Scripts

| Path | Role |
|------|------|
| `scripts/single-core-ledger/run-phase-3d-bs-pl-golden-capture.mjs` | Production preview capture (read-only) |
| `scripts/single-core-ledger/generate-phase-3d-reports.mjs` | Report generator |

## Docs

| Path | Role |
|------|------|
| `docs/accounting/BALANCE_SHEET_EQUATION_FIX.md` | BS equation / equity rollup rules |
| `docs/accounting/SINGLE_CORE_LEDGER_PER_COMPANY_ROLLOUT_RUNBOOK.md` | Per-company loader rollout pattern |

## Proposed loader flags (NOT enabled)

- `unified_ledger_loader_balance_sheet`
- `unified_ledger_loader_profit_loss`
- `unified_ledger_screen_balance_sheet`
- `unified_ledger_screen_profit_loss`

## Current production state

- **Main loaders:** legacy `getBalanceSheet` / `getProfitLoss`
- **Preview compare:** Phase 3A deployed; toggle default OFF
- **Cash Flow:** unified main loader LIVE (separate phase — not in BS/P&L scope)
- **Five unified loaders per company:** Ledger V2, Account Statement, TB, Party Ledger, Roznamcha (+ Cash Flow)

## Post-correction note

Phase 3D candidate goldens captured **2026-06-29** (before DIN BRIDAL 1100 Option C apply on 2026-06-30). Fresh BS/P&L preview capture recommended before signed swap approval for DIN BRIDAL.
