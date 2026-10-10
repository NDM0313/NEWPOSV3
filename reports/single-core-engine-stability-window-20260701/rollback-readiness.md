# Rollback readiness

## Level 1 — feature flag rollback (primary)

- Disable unified loader flags per company/screen; **no DB restore required**
- Kill switch (env/DB) forces legacy effective path immediately
- Reference: [`SINGLE_CORE_LEDGER_PHASE_2_9_PILOT_ENABLEMENT_PLAN.md`](../../docs/accounting/SINGLE_CORE_LEDGER_PHASE_2_9_PILOT_ENABLEMENT_PLAN.md)

## Loader-specific rollback (approval-gated)

| Loader | Status |
|--------|--------|
| Cash Flow main (3B-M) | LIVE — rollback requires **written operator approval** |
| BS/P&L | COMPLETE 2026-07-01 — flag rollback requires **written approval** |
| Core loaders (Roznamcha, TB, PL, AS, Party Ledger, Ledger V2) | L1 flag rollback available |

## Monitoring drift (not a rollback)

If monitoring FAILs due to legitimate live shop activity, run read-only audit and operator-approved **fixture-only** golden refresh — do not mutate production GL.

## R8 legacy retirement

**NOT approved** during stability window. Requires 2–4 week stable run + final operator approval.
