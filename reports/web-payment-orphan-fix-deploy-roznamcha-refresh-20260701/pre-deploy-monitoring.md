# Pre-deploy monitoring

**Artifact:** `reports/single-core-ledger/operational-monitoring/three-company-monitoring-2026-07-02T07-12-38-883Z.json`

| Company | Result |
|---------|--------|
| DIN CHINA | **PASS** |
| DIN CHINA Admin Compare 9/9 | **PASS** |
| DIN BRIDAL | **FAIL** (Roznamcha Cash In / Closing only) |
| DIN COUTURE | **PASS** |
| migrations_run | false |
| gl_mutations | false |
| flags | unchanged |

## DIN BRIDAL actuals (verified)

| Metric | Actual (PKR) | Golden (old) | Delta |
|--------|--------------|--------------|-------|
| Trial Balance | 22,390,400 | 22,390,400 | 0 |
| Roznamcha Cash In | **2,026,850** | 2,116,850 | −90,000 |
| Roznamcha Cash Out | 917,780 | 917,780 | 0 |
| Roznamcha Closing | **1,109,070** | 1,199,070 | −90,000 |
| MR REHAN ALI closing | 530,000 | 530,000 | 0 |

**Classification:** EXPECTED_ORPHAN_CLEANUP_DRIFT — only Roznamcha drift; exactly 2×45,000 phantom cash removed. **Proceed** with fixture refresh.
