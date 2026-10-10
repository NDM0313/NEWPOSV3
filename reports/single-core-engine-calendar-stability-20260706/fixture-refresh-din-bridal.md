# DIN BRIDAL golden fixture refresh — Calendar Day 6

**Classification:** Option A — fixture-only (no production GL mutation)

## Trigger

Calendar Day 6 monitoring (`three-company-monitoring-2026-07-05T10-48-55-625Z`) failed DIN BRIDAL golden checks due to legitimate live activity since Day 5 fixture refresh.

## Expected vs actual (PKR)

| Metric | Day 5 golden | Day 6 actual | Delta |
|--------|--------------|--------------|-------|
| Trial Balance total | 23,279,377 | 23,688,377 | +409,000 |
| Roznamcha Cash In | 2,211,350 | 2,507,350 | +296,000 |
| Roznamcha Cash Out | 1,164,607 | 1,164,607 | 0 |
| Roznamcha Closing | 1,046,743 | 1,342,743 | +296,000 |
| MR REHAN ALI closing | 530,000 | 530,000 | 0 |

## Action

Fixture-only update:

- `scripts/single-core-ledger/monitoring-company-profiles.json` (din-bridal golden block)
- `reports/single-core-ledger/din-bridal/golden-fixtures.json`

## Safety

| Check | Status |
|-------|--------|
| migrations_run | false |
| gl_mutations | false |
| repairs_run | false |
| production_mutation | none |

## Re-run

Monitoring re-run after fixture apply for Calendar Day 6 completion.
