# TypeScript debt — repo-wide (separate from Reports Export Formatting Patch)

**Date:** 2026-06-10  
**Status:** Tracking only — **not blocking production deploy**

## Context

`npx tsc --noEmit` reports many errors across unrelated modules (App.tsx routing, accounting demos, studio services, etc.). These pre-date Phase 1 Reports Export Formatting Patch.

## Deploy path (does not use tsc)

| Command | TypeScript gate? |
|---------|------------------|
| `npm run build` | No — Vite only |
| `npm run deploy:prepare` | No — migrations + Vite |
| Docker `deploy/Dockerfile` | `npm run build` only |

**Verified:** `npm run build` exit 0 on 2026-06-10.

## Phase 1 touched files

No tsc errors in:

- `src/app/components/reports/shared/*` (Phase 1 exports)
- `src/app/features/ledger-statement-center-v2/*`
- `src/app/components/reports/StockReportPage.tsx`
- `src/app/components/reports/ProductSellReportPage.tsx`
- `src/app/components/settings/printing/ReportExportPreviewPanel.tsx`

Only project-wide hit when filtering: `src/main.tsx` CSS side-effect import (existing pattern).

## Recommended cleanup (future PR, not Phase 1)

1. Fix high-churn modules first: `App.tsx`, `accountingService` callers, `settingsService.ts`
2. Add `npm run typecheck` script only when error count is manageable
3. Do **not** block formatting/export patches on full-repo tsc until debt is reduced

---

*Do not mix this plan with Reports Export Formatting Patch Phase 1 acceptance.*
