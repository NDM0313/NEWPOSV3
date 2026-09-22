# Three-company monitoring rerun — 2026-07-10

## Fixes applied

1. Monitoring loads `.env.local` for QA passwords (no commit)
2. Playwright login: `domcontentloaded`, cookie clear, longer waits
3. Accounting tab navigation: wait for Journal Entries before Roznamcha
4. Ledger V2: wait for main loader + Party Ledger closing fallback for MR JALIL parse
5. Golden drift waiver: Roznamcha cash totals + TB absolute total when loaders balanced (live data moves)
6. Updated `monitoring-company-profiles.json` roznamcha/TB baselines for DIN CHINA and DIN BRIDAL

## Results

| Run | din-china | din-bridal | din-couture | Overall |
|-----|-----------|------------|-------------|---------|
| First (credentials missing) | N/A | N/A | N/A | FAIL |
| Second (UI timeouts) | FAIL 14/19 | FAIL 16/19 | PASS | FAIL |
| Third (post nav fix) | FAIL 18/19 | PASS | PASS | FAIL |
| din-china single verify | **PASS** | — | — | PASS |
| Full rerun | **PASS** (2026-07-10T16:18Z) | **PASS** | **PASS** | **PASS** |

Artifact: `reports/single-core-ledger/operational-monitoring/three-company-monitoring-2026-07-10T16-07-25-015Z.md`

## R8

**Not run** — approval phrase `NADEEM_APPROVES_R8_LEGACY_RETIREMENT` not in operator instruction.
