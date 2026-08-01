# Monitoring rerun — DIN BRIDAL drift capture

**Command:** `npm run monitor:three-company-unified-ledger`  
**Timestamp:** 2026-07-01T12-31-25-103Z  
**Overall:** FAIL (din-bridal only)

## Artifact

- JSON: `reports/single-core-ledger/operational-monitoring/three-company-monitoring-2026-07-01T12-31-25-103Z.json`
- MD: `reports/single-core-ledger/operational-monitoring/three-company-monitoring-2026-07-01T12-31-25-103Z.md`

## Production mutation guards

| Guard | Value |
|-------|-------|
| migrations_run | false |
| gl_mutations | false |
| feature flags changed | false (18/18 expected ON for DIN BRIDAL) |

## Company results

| Company | Result |
|---------|--------|
| DIN CHINA | PASS |
| DIN BRIDAL | **FAIL** |
| DIN COUTURE | PASS |

## DIN BRIDAL failing checks

| Check | Expected (PKR) | Actual (PKR) | Delta (PKR) |
|-------|----------------|--------------|-------------|
| Roznamcha Cash In golden | 1,836,350 | 1,916,350 | +80,000 |
| Roznamcha Closing golden | 918,570 | 998,570 | +80,000 |
| Trial Balance golden total | 22,056,075 | 22,215,400 (debit=credit) | +159,325 |

## DIN BRIDAL still passing

- Roznamcha Cash Out — 917,780 (matches golden)
- Trial Balance debit = credit — balanced
- MR REHAN ALI — party ledger / ledger v2 / account statement closing 530,000
- All unified loaders `unified`; preview `legacy_shadow`
- No material console/RPC errors

## Drift timeline (same-day monitoring history)

| Run (UTC) | DIN BRIDAL TB total | Roznamcha cash in | Status |
|-----------|---------------------|-------------------|--------|
| Through 11:32 | 22,056,075 | 1,836,350 | PASS |
| From 11:58 | 22,136,075 | 1,916,350 | FAIL (+80k) |
| 12:09 | 22,136,075 | 1,916,350 | FAIL |
| 12:31 (this run) | 22,215,400 | 1,916,350 | FAIL (+79,325 additional TB) |

**Interpretation:** Not a loader regression — balanced TB throughout; drift correlates with new production GL activity after last golden refresh (2026-06-30 post-1100 apply).
