# BS/P&L loader swap — approval pack

**Status:** `BLOCKED_PENDING_FINANCE_APPROVAL`  
**Generated:** 2026-06-30

## Current status

- **Main loaders:** legacy `getBalanceSheet` / `getProfitLoss`
- **Preview compare:** Phase 3A deployed; default **OFF** (preview-only)
- **Finance sign-off:** **PENDING**

## Before swap

| Gate | Status |
|------|--------|
| Finance approval manifest | PENDING |
| Rule confirmations (BS equity rollup, P&L COGS) | Required |
| Per-company golden compare | Required |
| Rollback SQL per loader pattern | Prepare |
| `npm run test:unified-ledger` + build | PASS at baseline |
| Deploy plan | Separate approval |

## Proposed flags (not enabled)

- `unified_ledger_loader_balance_sheet`
- `unified_ledger_loader_profit_loss`
- Screen flags as per rollout runbook

## Rollout steps (when approved)

1. Pre-swap monitoring PASS
2. Frontend deploy (if code delta)
3. Enable screen + loader flags per company (one at a time or batch per approval)
4. Post-swap golden capture + Admin Compare
5. Rollback via L1 flag disable if drift

## Written approval required

> I approve BS/P&L unified main loader swap for **[company]** per Phase 3D finance sign-off dated ______. Signed: ______

## Do not execute

No loader swap, no flags, no deploy in this run.

Reference: [`phase-3d-bs-pl-golden-capture/bs-pl-loader-swap-gate.md`](../single-core-ledger/phase-3d-bs-pl-golden-capture/bs-pl-loader-swap-gate.md)
