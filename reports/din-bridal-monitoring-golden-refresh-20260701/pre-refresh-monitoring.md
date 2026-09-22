# Pre-refresh monitoring

**Artifact:** `three-company-monitoring-2026-07-01T13-53-24-973Z`  
**Overall:** FAIL (expected against old goldens)

| Company | Result |
|---------|--------|
| DIN CHINA | PASS |
| DIN BRIDAL | FAIL |
| DIN COUTURE | PASS |

## DIN BRIDAL actuals (pre-refresh)

| Metric | Old golden | Actual |
|--------|------------|--------|
| Trial Balance total | 22,056,075 | **22,390,400** |
| Roznamcha Cash In | 1,836,350 | **2,116,850** |
| Roznamcha Cash Out | 917,780 | 917,780 |
| Roznamcha Closing | 918,570 | **1,199,070** |
| MR REHAN ALI closing | 530,000 | 530,000 |

`migrations_run: false` | `gl_mutations: false` | flags unchanged
