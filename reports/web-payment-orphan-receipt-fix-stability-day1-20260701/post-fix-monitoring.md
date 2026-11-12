# Post-fix monitoring

**Artifact:** `reports/single-core-ledger/operational-monitoring/three-company-monitoring-2026-07-01T15-45-25-569Z.json`

| Company | Result |
|---------|--------|
| DIN CHINA | **PASS** |
| DIN CHINA Admin Compare 9/9 | **PASS** |
| DIN BRIDAL | **FAIL** (Roznamcha Cash In / Closing golden) |
| DIN COUTURE | **PASS** |
| migrations_run | false |
| gl_mutations | false |
| Loader flags | unchanged |

**Overall:** FAIL

**Classification:** DIN BRIDAL Roznamcha Cash In **2,026,850** vs golden **2,116,850** (−90,000 = 2×45,000 orphan payments). Caused by **orphan soft-cancel** removing zero-line payment rows from Roznamcha — **correct operational correction**, not a GL regression. TB still **PASS** at 22,390,400. Fixture refresh **not** applied automatically per stability rules.
