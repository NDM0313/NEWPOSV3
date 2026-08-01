# Phase 2.10A — Test results

**Run id:** `9dfb2f`  
**Command:** `npm run test:unified-ledger`  
**Result:** **147/147 PASS** (2026-06-14)  
**Build:** `npm run build` — **PASS**

## Unit / integration coverage

| # | Scenario | Test file | Status |
|---|----------|-----------|--------|
| 1 | Loader flag OFF → legacy main | `resolveLedgerV2MainLoaderSource.test.ts` | PASS |
| 2 | Loader ON + engine ON + screen ON → unified | `resolveLedgerV2MainLoaderSource.test.ts` | PASS |
| 3 | Kill switch ON → legacy | `resolveLedgerV2MainLoaderSource.test.ts` | PASS |
| 4 | Loader ON, engine OFF → legacy | `resolveLedgerV2MainLoaderSource.test.ts` | PASS |
| 5 | Loader ON, screen OFF → legacy | `resolveLedgerV2MainLoaderSource.test.ts` | PASS |
| 6 | Wrong company (no loader flag) → legacy | `resolveLedgerV2MainLoaderSource.test.ts` | PASS |
| 7 | MR JALIL unified closing 216,300 | `ledgerV2MainLoaderExportParity.test.ts` | PASS |
## Browser QA (2.10B baseline)

**Result:** **PASS** @ 2026-06-26 — see `baseline-loader-qa.md`, `browser-qa-baseline.json`

| # | Scenario | Status |
|---|----------|--------|
| 8 | Pilot batch 9/9 | PASS (browser) |
| 10 | Staff preview hidden | WAIVED (no staff creds) |
| 9 | Export spot-check | PASS (signed) |
| 11 | Other screens unaffected | Resolver scoped to Ledger V2 page only | PASS (code review) |
| 12 | L1 rollback → legacy | `resolveLedgerV2MainLoaderSource.test.ts` | PASS |

## Browser QA

| Mode | Script | When |
|------|--------|------|
| `baseline` | `run-phase-210-loader-browser-qa.mjs baseline` | After code deploy; loader flag OFF |
| `candidate` | `run-phase-210-loader-browser-qa.mjs candidate` | Preview/staging only after ops enables loader flag |
| `rollback` | `run-phase-210-loader-browser-qa.mjs rollback` | After L1 rollback SQL |

## Export spot-check gate

**Not signed** — required before candidate-mode loader QA and production enable SQL.
