# Phase 3B implementation report — Cash Flow unified preview

**Status:** IMPLEMENTED (preview-only)  
**Generated:** 2026-06-29T14:00:00.000Z  
**Base commit:** `51f308c6`

---

## Summary

Phase 3B adds admin/developer/integrity-lab **preview-only** compare on the Cash Flow page. Legacy `getCashFlowReport` remains the main output. Unified preview derives from `loadRoznamchaUnifiedPreview` + `cashFlowUnifiedPreviewMapper`.

---

## Files added

| File | Purpose |
|------|---------|
| `src/app/lib/accounting/cashFlowUnifiedPreviewMapper.ts` | Map unified rows → CF summary |
| `src/app/lib/accounting/cashFlowUnifiedPreviewDiff.ts` | Legacy vs preview diff |
| `src/app/lib/accounting/cashFlowUnifiedPreviewAccess.ts` | Role gate |
| `src/app/services/cashFlowUnifiedPreviewService.ts` | Parallel preview loader |
| `src/app/components/accounting/CashFlowUnifiedPreviewPanel.tsx` | Compare UI + JSON export |

## Files modified

| File | Change |
|------|--------|
| `src/app/components/reports/CashFlowReportPage.tsx` | Preview toggle (default OFF) + panel wiring |
| `package.json` | Added Phase 3B unit tests to `test:unified-ledger` |

## Tests added

- `cashFlowUnifiedPreviewMapper.test.ts`
- `cashFlowUnifiedPreviewDiff.test.ts`
- `cashFlowUnifiedPreviewAccess.test.ts`

---

## Behavior

- Toggle visible only to allowed roles
- Default **OFF** — legacy table unchanged
- Compare: cash in, cash out, net movement, closing, row count
- `PREVIEW_ONLY` / `NEEDS_FINANCE_GOLDEN_APPROVAL` labels
- No feature flags, migrations, or GL mutations

---

## Known limitation

Cash Flow main loader still uses `roznamchaService`; unified Roznamcha main is not swapped. Preview compares legacy roznamcha-derived CF vs unified RPC-derived CF.

---

## Deploy

**NOT RUN** — operator approval required for production preview UI.
