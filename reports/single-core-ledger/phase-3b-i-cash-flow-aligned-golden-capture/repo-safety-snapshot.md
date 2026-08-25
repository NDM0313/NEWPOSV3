# Repo safety snapshot — Phase 3B-H-PROD + 3B-I

**Generated:** 2026-06-29  
**Branch:** `main`  
**HEAD:** `d2401b1f` — feat(accounting): align Cash Flow preview to finance rules  
**origin/main:** includes `d2401b1f` or newer  
**Staged files:** none

## Phase 3B-H runtime code

Present locally and on `origin/main`:

- `src/app/lib/accounting/cashFlowPreviewFinanceAlignment.ts`
- `src/app/lib/accounting/cashFlowUnifiedPreviewMapper.ts`
- `src/app/components/accounting/CashFlowUnifiedPreviewPanel.tsx`
- `src/app/lib/accounting/cashFlowRowKeyedExport.ts`

## Excluded dirty files (not staged)

- `graphify-out/GRAPH_REPORT.md`
- DIN BRIDAL `golden-fixtures.*`, `golden-capture/*`, monitoring production flags/report
- `latest-three-company-monitoring.*` and timestamped monitoring outside Phase 3B-I
- DIN COUTURE / phase-2-16 timestamp refresh files
- `final-office-pc-local-status.*`

## Constraints

- Frontend deploy only — no migrations, flags, GL/data mutations
- Cash Flow loader swap NOT APPROVED
- Official legacy Cash Flow unchanged
