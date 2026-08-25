# Source rule map — Phase 3B-E

Read-only code inspection of legacy vs preview Cash Flow paths.

| Rule | Legacy | Preview | Match | Explains delta? | Risk | Owner |
|------|--------|---------|-------|-----------------|------|-------|
| Primary data engine | `roznamchaService.getRoznamcha` | `get_unified_cash_bank_ledger` | **NO** | **YES** (both) | HIGH | both |
| Internal transfer legs | Transfer rows often cash-in only in legacy Transfers module | Unified shows in **and** out legs (`transfer` ref) | **NO** | **YES** (DIN CHINA) | HIGH | finance |
| Void/reversal normal | SQL excludes voided when audit off | RPC effective_party excludes correction_reversal | partial | partial | MEDIUM | both |
| Opening balance rows | Roznamcha opening summary | RPC may emit `opening_balance_account` lines | **NO** | **YES** (DIN BRIDAL) | MEDIUM | finance |
| Source module filter | `filterCashFlowRowsBySourceModule` | Same on mapped unified rows | YES | no | LOW | engineering |
| Branch scope | context branchId | same to RPC | YES | partial (China selected branch) | MEDIUM | engineering |
| Liquidity accounts | roznamcha account filter | RPC liquidity=all | partial | YES (China) | MEDIUM | both |
| Running balance | recompute on legacy rows | RPC running balance | partial | no | LOW | engineering |

## Key code references

- Legacy loader: `src/app/services/cashFlowReportService.ts#getCashFlowReport`
- Preview loader: `src/app/services/cashFlowUnifiedPreviewService.ts`
- Mapper: `src/app/lib/accounting/cashFlowUnifiedPreviewMapper.ts`
- Visibility: `src/app/lib/reportVisibilityContract.ts`
- Compare: `src/app/lib/accounting/cashFlowUnifiedPreviewDiff.ts`
