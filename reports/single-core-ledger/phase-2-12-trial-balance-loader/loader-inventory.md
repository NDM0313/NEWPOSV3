# Phase 2.12 — loader inventory

| Component | Path | Role |
|-----------|------|------|
| Main page | `src/app/components/reports/TrialBalancePage.tsx` | Loader resolution + main table + exports |
| Preview panel | `src/app/components/reports/TrialBalanceUnifiedPreviewPanel.tsx` | Compare UI + QA attributes |
| Main loader resolver | `src/app/lib/resolveTrialBalanceMainLoaderSource.ts` | Flag gate priority |
| Preview compare resolver | `src/app/lib/resolveTrialBalancePreviewCompareSource.ts` | Inverted compare source |
| Legacy main service | `src/app/services/trialBalanceLegacyMainService.ts` | Default + shadow compare |
| Unified main service | `src/app/services/trialBalanceUnifiedMainService.ts` | Unified RPC main (shadowForce: false) |
| Legacy shadow service | `src/app/services/trialBalanceLegacyShadowPreviewService.ts` | Preview when main unified |
| Unified preview service | `src/app/services/trialBalanceUnifiedPreviewService.ts` | Preview when main legacy |
| Flag key | `unified_ledger_loader_trial_balance` | L1 loader switch |
| Screen flag | `unified_ledger_screen_trial_balance` | Screen gate |
| Exports | PDF/Excel via active main `data` rows | Active main rows authority |

**Ledger V2 / Account Statement:** unchanged loaders.
