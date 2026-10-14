# Phase 2.15X — Final closeout

**Status:** `PHASE 2.15X FINAL CLOSEOUT PASS WITH WAIVERS — DIN CHINA unified reporting live and monitored`

**Commit:** `b8b093f7` — `fix(accounting): restore Roznamcha parity for DIN CHINA unified loader`  
**Branch:** `feature/single-core-ledger-phase-2-9a3-preview-deploy-plan`  
**Deploy label:** `phase-215-prod`

---

## Closeout checklist

| Step | Result |
|------|--------|
| Phase 2.15 code committed and pushed | PASS (`b8b093f7`) |
| Repo matches VPS (`assembleRoznamchaUnifiedParityMain` in bundle) | PASS |
| `npm run test:unified-ledger` | 232 PASS |
| `npm run build` | PASS |
| Production flags verified | PASS — `phase-215x-final-flags.json` |
| Five screens unified on production | PASS |
| Roznamcha golden totals exact | PASS |
| Docs updated | PASS |
| Monitoring pack created | PASS |

## Live DIN CHINA loaders

Ledger V2, Account Statement, Trial Balance, Party Ledger, Roznamcha — all **ON**.

## Phase 2.15 fix summary

- Root cause: raw GL RPC mapping vs payment+journal roznamcha composite
- Fix: `roznamchaUnifiedParityAssembler` routes unified loader through `getRoznamcha`
- No migration, no GL mutation

## Waivers (non-blocking)

- Ledger V2 MR JALIL Playwright parse NaN
- Admin Compare timing pass count

See `phase-215x-waiver-note.md`.

## Rollback inventory (do not execute unless regression)

| Level | Script | Scope |
|-------|--------|-------|
| L1 Roznamcha loader | `phase-214-rollback-roznamcha-loader.sql` | Loader OFF → legacy main |
| L2 Roznamcha screen | `phase-214-rollback-roznamcha-screen.sql` | Screen OFF |
| L1 Party Ledger loader | `phase-213-rollback-party-ledger-loader.sql` | |
| L2 Party Ledger screen | `phase-213-rollback-party-ledger-screen.sql` | |
| L1 Trial Balance loader | `phase-212-rollback-trial-balance-loader.sql` | |
| L2 Trial Balance screen | `phase-212-rollback-trial-balance-screen.sql` | |
| L1 Account Statement loader | `phase-211-rollback-account-statement-loader.sql` | |
| L2 Account Statement screen | `phase-211-rollback-account-statement-screen.sql` | |
| L1 Ledger V2 loader | `phase-210-rollback-loader-ledger-v2.sql` | |
| L2 Ledger V2 screen | `phase-29c-rollback-screen-ledger-v2.sql` | |
| Engine OFF | `phase-29c-rollback-engine.sql` | Company engine |
| Pilot OFF | `phase-29b-rollback-pilot.sql` | Pilot flag |
| Kill switch | `unified_ledger_engine_state` / env `VITE_UNIFIED_LEDGER_KILL_SWITCH` | Emergency RPC block |

## Deferred / next

- Admin Compare Cash/Bank raw RPC parity (shadow; waived)
- Optional `roznamcha_payment` RPC mode — separate migration approval
- Other companies — separate finance sign-off

## Monitoring

See `phase-215x-24h-monitoring-checklist.md`.
