# Post-posting monitoring

**Generated:** 2026-06-30  
**Overall:** **EXPECTED_PARTIAL_FAIL** — approved test mutation on DIN CHINA MR JALIL

| Profile | Result | Notes |
|---------|--------|-------|
| din-china | **FAIL** (expected) | MR JALIL closing **216299** vs golden **216300** — PKR 1 discount JE-0003 |
| din-bridal | **PASS** | Unchanged |
| din-couture | **PASS** | Unchanged |

| Guard | Value |
|-------|--------|
| other-company loaders | 0 |
| migrations_run | false |
| gl_mutations (monitoring flag) | false |
| Unexpected GL mutations | **None** beyond approved JE |

**Classification:** `APPROVED_TEST_MUTATION` — din-china golden party balance drift is expected until golden fixtures updated or JE reversed.

Evidence: `three-company-monitoring-2026-06-30T07-47-00-839Z.json`
