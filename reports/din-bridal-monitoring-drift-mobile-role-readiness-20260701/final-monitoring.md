# Final monitoring

**Command:** `npm run monitor:three-company-unified-ledger`  
**Timestamp:** 2026-07-01T12-43-13-370Z  
**Overall:** FAIL

## Artifact

`reports/single-core-ledger/operational-monitoring/three-company-monitoring-2026-07-01T12-43-13-370Z.json`

## Guards

| Guard | Value |
|-------|-------|
| migrations_run | false |
| gl_mutations | false |

## Results

| Company | Result |
|---------|--------|
| DIN CHINA | PASS |
| DIN BRIDAL | **FAIL** |
| DIN COUTURE | PASS |

## DIN BRIDAL failing checks (final run)

| Check | Expected (PKR) | Actual (PKR) | Delta (PKR) |
|-------|----------------|--------------|-------------|
| Roznamcha Cash In | 1,836,350 | 1,958,350 | +122,000 |
| Roznamcha Closing | 918,570 | 1,040,570 | +122,000 |
| Trial Balance total | 22,056,075 | 22,257,400 | +201,325 |

TB debit = credit: **PASS** (22,257,400 = 22,257,400)

## Ongoing drift

Totals **increased again** between the 12:31 and 12:43 runs (TB +42,000; roznamcha +42,000), confirming **live production GL activity** during the diagnosis window — not a transient monitoring failure.
