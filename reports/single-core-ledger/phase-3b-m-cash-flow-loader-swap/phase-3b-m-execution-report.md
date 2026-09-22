# Phase 3B-M execution report — Cash Flow controlled loader swap

**Status:** EXECUTED  
**Date:** 2026-06-29  
**Operator:** Nadeem Khan (written approval on record)

## Summary

Cash Flow unified main loader is **LIVE** for DIN CHINA, DIN BRIDAL, and DIN COUTURE. Official Cash Flow now uses finance-aligned unified basis (Q4=A, Q5=C, Q7=B) when loader flags are ON. Legacy path remains available via flag rollback or kill switch.

## Sequence

| Step | Result |
|------|--------|
| Pre-swap monitoring (12 flags) | **PASS** |
| Code commit `36543345` | **PUSHED** |
| Frontend deploy `deploy/vps-build-erp-only.sh` | **PASS** (retry after container race) |
| Enable `unified_ledger_screen_cash_flow` × 3 | **INSERT 0 3** |
| Enable `unified_ledger_loader_cash_flow` × 3 | **INSERT 0 3** |
| Post-swap smoke (DIN CHINA) | **PASS** — `data-cash-flow-main-loader=unified` |
| Post-swap monitoring (14 flags) | **PASS** |

## Runtime changes

| File | Change |
|------|--------|
| `resolveCashFlowMainLoaderSource.ts` | Loader resolution (mirror roznamcha pattern) |
| `cashFlowUnifiedMainMapper.ts` | Finance-aligned main row/summary mapping |
| `cashFlowUnifiedMainService.ts` | Unified main load path |
| `CashFlowReportPage.tsx` | Branch main load on resolver |
| `unifiedLedgerFlagKeys.ts` | `LOADER_CASH_FLOW`, `SCREEN_CASH_FLOW` |
| `monitoring-company-profiles.json` | 14 expected flags |

## Finance basis

- **DIN CHINA / DIN BRIDAL:** totals differ from legacy (accepted per Phase 3B-K)
- **DIN COUTURE:** zero-diff vs aligned candidate
- **No GL/data mutations**

## Rollback

```bash
# L1 — disable loader only (legacy main restored)
Get-Content scripts/single-core-ledger/phase-3b-m-cash-flow-loader-swap/rollback-loader-cash-flow-all-three.sql | ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres"
```

## Tests

298/298 PASS · build PASS

## Still blocked

- BS/P&L finance **PENDING**
- R7 **DESIGN_ONLY** · R8 **BLOCKED** · next company **BLOCKED**
