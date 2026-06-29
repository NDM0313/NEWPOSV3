# Phase 3B-F implementation report

**Run:** PHASE 3B-F — Cash Flow row-keyed export + deeper diff tooling  
**Status:** IMPLEMENTED (diagnostic-only)

## Summary

Phase 3B-F adds preview-only Cash Flow diagnostic export with stable row keys, normalized legacy/preview rows, thematic diff buckets, and a local comparison script. **Official legacy Cash Flow behavior and totals are unchanged.**

## Runtime changes

| Area | Change |
|------|--------|
| `cashFlowRowKey.ts` | Stable keys, confidence, transfer/opening/visibility classification |
| `cashFlowRowNormalizer.ts` | Normalize legacy `CashFlowRow` + preview `UnifiedLedgerRow` |
| `cashFlowRowDiffBuckets.ts` | Exact/strong/weak matches + thematic buckets |
| `cashFlowRowKeyedExport.ts` | `buildCashFlowRowKeyedExport()` payload |
| `CashFlowUnifiedPreviewPanel.tsx` | "Export row-keyed JSON" button, match counts |
| `CashFlowReportPage.tsx` | Passes `companyId` + `legacyReport` to preview panel |

## Non-changes (hard constraints honored)

- No migrations, flags, GL/data mutation
- No Cash Flow loader swap
- Default Cash Flow output unchanged; preview toggle default OFF
- BS/P&L finance remains PENDING
- R7 DESIGN_ONLY; R8 and next company BLOCKED

## Tests

`npm run test:unified-ledger` — 280/280 PASS (includes `cashFlowRowKey.test.ts`)

## Build

`npm run build` — PASS

## Deploy

**DEPLOY NOT RUN** — operator approval required (preview diagnostic UI changed).

## Finance

DIN CHINA / DIN BRIDAL deltas still need finance rule confirmation before any behavior change or loader swap.
