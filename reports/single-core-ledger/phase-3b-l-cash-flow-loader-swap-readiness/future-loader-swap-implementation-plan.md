# Future loader-swap implementation plan — Phase 3B-M (NOT APPROVED)

**Status:** Future-only — **do not execute** without operator written approval.

## Proposed phase name

**Phase 3B-M — Cash Flow Controlled Loader Swap**

## Preconditions

1. Phase 3B-K finance basis sign-off **complete**
2. Phase 3B-L readiness pack **complete**
3. **Operator written approval** on record ([`operator-loader-swap-approval-template.md`](operator-loader-swap-approval-template.md))
4. `resolveCashFlowMainLoaderSource.ts` + flag keys implemented
5. `npm run test:unified-ledger` PASS · `npm run build` PASS
6. Pre-swap `npm run monitor:three-company-unified-ledger` PASS

## Flag / loader design

| Key | Purpose |
|-----|---------|
| `unified_ledger_loader_cash_flow` | Switches main Cash Flow loader |
| `unified_ledger_screen_cash_flow` | Screen gate (with engine) |
| `unified_ledger_engine` | Already ON for three companies |
| `unified_ledger_kill_switch` | Emergency legacy force |

Unified main when: **loader ∧ engine ∧ screen ∧ ¬kill_switch**

Main path should use **finance-aligned** `cashFlowUnifiedPreviewMapper` (Q4=A, Q5=C, Q7=B).

## Expected files (implementation phase)

- `src/app/lib/unifiedLedgerFlagKeys.ts`
- `src/app/lib/unifiedLedgerScreenFlags.ts`
- `src/app/lib/resolveCashFlowMainLoaderSource.ts` (new)
- `src/app/services/cashFlowReportService.ts` / `CashFlowReportPage.tsx`
- Monitoring profile updates (optional)

## Smoke test steps (post-swap)

1. Login each company (DIN CHINA, DIN BRIDAL, DIN COUTURE)
2. Cash Flow loads; no material console/RPC errors
3. Main totals reflect unified finance-aligned basis
4. Export/print functional
5. Compare panel behavior per final UX decision

## Monitoring

```bash
npm run monitor:three-company-unified-ledger
```

## Rollback

See [`rollback-and-safety-plan.md`](rollback-and-safety-plan.md)

## Commit / deploy sequence

1. Code + tests locally  
2. Commit + push  
3. **Frontend deploy** (`deploy/vps-build-erp-only.sh`) — operator approved only  
4. Enable `unified_ledger_screen_cash_flow` if not already ON  
5. Enable `unified_ledger_loader_cash_flow` per company plan  
6. Post-swap smoke + monitoring  
7. Evidence commit under `phase-3b-m-*`

## Stop conditions

- Monitoring FAIL  
- GL mutations  
- Unexpected flags on other companies  
- Operator or finance halt  

## Required operator approval text

> I approve Phase 3B-M Cash Flow controlled loader swap planning/execution for DIN CHINA, DIN BRIDAL, and DIN COUTURE. I understand that aligned preview finance basis differs from legacy Cash Flow for DIN CHINA and DIN BRIDAL. I approve proceeding to a controlled loader-swap phase only; no GL/data mutations are approved.

**Loader swap NOT APPROVED until this text is recorded.**
