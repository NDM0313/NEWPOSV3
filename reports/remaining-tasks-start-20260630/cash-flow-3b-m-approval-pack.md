# Cash Flow Phase 3B-M — approval pack

**Status:** `OPERATIONAL_LIVE` — re-swap/rollback requires operator approval  
**Generated:** 2026-06-30

## Current status

Unified Cash Flow **main loader is LIVE** for all three companies (executed 2026-06-29, commit `36543345`). Finance basis **Q4=A, Q5=C, Q7=B**.

## Flags (per company)

- `unified_ledger_screen_cash_flow`
- `unified_ledger_loader_cash_flow`

## Known accepted deltas

- DIN CHINA / DIN BRIDAL: non-zero vs legacy (finance-approved)
- DIN COUTURE: zero-diff aligned candidate

## Rollback (L1 — loader only)

```bash
Get-Content scripts/single-core-ledger/phase-3b-m-cash-flow-loader-swap/rollback-loader-cash-flow-all-three.sql | ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres"
```

Then verify legacy main loader in UI smoke.

## Monitoring checks

- `npm run monitor:three-company-unified-ledger` PASS
- `data-cash-flow-main-loader=unified` when flags ON
- `migrations_run` / `gl_mutations` false

## Written approval (for rollback or re-enable)

> I approve Cash Flow unified main loader **[enable | rollback]** for **[DIN CHINA | DIN BRIDAL | DIN COUTURE | all three]** per phase-3b-m runbook dated ______. Signed: ______

## Do not execute in this run

No loader swap, no flag toggle, no deploy.

Reference: [`reports/single-core-ledger/phase-3b-m-cash-flow-loader-swap/`](../single-core-ledger/phase-3b-m-cash-flow-loader-swap/)
