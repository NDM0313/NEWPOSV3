# Loader architecture map — Phase 3B-L

**Generated:** 2026-06-29  
**Cash Flow loader flag exists today:** **NO**

## Existing five-loader pattern

Each approved screen uses a **triple gate** read from `feature_flags` (company-scoped):

| Gate | Key pattern | Example |
|------|-------------|---------|
| Loader | `unified_ledger_loader_<screen>` | `unified_ledger_loader_roznamcha` |
| Engine | `unified_ledger_engine` | company engine ON |
| Screen | `unified_ledger_screen_<screen>` | `unified_ledger_screen_roznamcha` |
| Kill switch | `unified_ledger_kill_switch` | forces legacy if ON |

Resolver files: `resolveLedgerV2MainLoaderSource.ts`, `resolveAccountStatementMainLoaderSource.ts`, `resolveTrialBalanceMainLoaderSource.ts`, `resolvePartyLedgerMainLoaderSource.ts`, `resolveRoznamchaMainLoaderSource.ts`.

Flag constants: [`unifiedLedgerFlagKeys.ts`](../../../src/app/lib/unifiedLedgerFlagKeys.ts)  
Screen IDs: [`unifiedLedgerScreenFlags.ts`](../../../src/app/lib/unifiedLedgerScreenFlags.ts)  
Flag service: [`featureFlagsService.ts`](../../../src/app/services/featureFlagsService.ts)

## Cash Flow today

| Path | Entry | Loader |
|------|-------|--------|
| **Official (main)** | `CashFlowReportPage.tsx` → `getCashFlowReport()` | Legacy `roznamchaService` |
| **Preview (toggle)** | `loadCashFlowUnifiedPreview()` → `mapUnifiedRowsToCashFlowPreview()` | Unified roznamcha-derived; Q4/Q5/Q7 aligned |

Preview is **role-gated**, **default OFF**, and does **not** replace main loader.

## Proposed future flags (NOT created in this phase)

| Purpose | Proposed key |
|---------|----------------|
| Cash Flow main loader swap | `unified_ledger_loader_cash_flow` |
| Cash Flow screen gate | `unified_ledger_screen_cash_flow` |

Follows existing `unified_ledger_loader_*` / `unified_ledger_screen_*` naming.

## Future implementation touch points

1. Add flag keys to `unifiedLedgerFlagKeys.ts` and `unifiedLedgerScreenFlags.ts`
2. Create `resolveCashFlowMainLoaderSource.ts` (mirror roznamcha resolver)
3. Branch `CashFlowReportPage` / `cashFlowReportService` main load path
4. Wire finance-aligned mapper (`cashFlowUnifiedPreviewMapper` + Q4/Q5 rules) as unified main source
5. Extend monitoring profiles if Cash Flow loader checks added
6. Rollback SQL templates per company (pattern: `scripts/single-core-ledger/din-couture/dc-rollback-loader-*.sql`)

## Rollback path

1. **Disable loader flag** — `feature_flags` row `unified_ledger_loader_cash_flow` → false or DELETE
2. **Kill switch** — `unified_ledger_kill_switch` ON (emergency legacy everywhere)
3. **Frontend revert** — redeploy prior bundle if unified main path has runtime defect
4. **Verify** — `npm run monitor:three-company-unified-ledger`

## Monitoring path

```bash
npm run monitor:three-company-unified-ledger
```

## Risks and stop conditions

| Risk | Mitigation |
|------|------------|
| DIN CHINA/BRIDAL totals change for users | User-facing warning + finance acceptance on record |
| No flag exists yet | Implement flag + resolver in Phase 3B-M before any toggle |
| Other loaders destabilized | Monitoring guard: `other_company_loaders_on = 0` |
| GL/data mutation | Read-only monitoring; no migration in swap phase without approval |

**Stop if:** monitoring FAIL · unexpected flags · GL mutations · missing operator approval
