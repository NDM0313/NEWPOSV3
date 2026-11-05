# Post-keep monitoring

**Generated:** 2026-06-30  
**Overall:** **PARTIAL_PASS** — MR JALIL golden aligned; known drift on TB total and Admin Compare

## Profile results

| Profile | Result | Notes |
|---------|--------|-------|
| din-china | **PARTIAL** | All **MR JALIL** checks **PASS** at **216299** |
| din-bridal | **PASS** | Unchanged |
| din-couture | **PASS** | Unchanged |

## DIN CHINA detail

| Check | Result |
|-------|--------|
| Account Statement MR JALIL | **PASS** — 216299 |
| Party Ledger MR JALIL | **PASS** — 216299 |
| Ledger V2 MR JALIL | **PASS** — 216299 |
| Trial Balance golden total | **FAIL** — 407957272.02 vs config 407957271.02 |
| Admin Compare Pilot 9/9 | **FAIL** — production UI still has old 216300 constant |

### Classifications (no business data change)

- **Trial Balance +1:** `APPROVED_TEST_MUTATION_SIDE_EFFECT` from retained JE-0003 (TB golden not in scope for this update)
- **Admin Compare:** `UNDEPLOYED_FRONTEND_GOLDEN_CONSTANT` — `MR_JALIL_EXPECTED_BALANCE` source updated in repo; **no deploy** per constraints

| Guard | Value |
|-------|--------|
| other-company loaders | 0 |
| migrations_run | false |
| gl_mutations | false |

Evidence: `three-company-monitoring-2026-06-30T08-11-15-806Z.json`
