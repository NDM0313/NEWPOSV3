# R5 DIN BRIDAL — Soak plan

**Status:** SOAK REQUIRED (no accelerated waiver)  
**Loaders live since:** 2026-06-27  
**Company:** DIN BRIDAL (`597a5292-14c8-4cd8-96bd-c61b5a0d8c92`)

## Soak window

- **Minimum:** 72 hours production observation
- **Recommended monitoring:** Daily `MONITORING_PROFILE=din-bridal` golden verify
- **DIN CHINA regression:** Include in each daily run (reference company unchanged)

## Watch items

1. MR REHAN ALI closing remains 530,000 PKR on all five unified main loaders
2. Trial Balance debit = credit @ 21,919,575 PKR
3. Roznamcha golden totals stable
4. No DIN COUTURE / other-company loader leakage
5. No user-reported accounting discrepancies on DIN BRIDAL screens

## Rollback

Per-loader L1 rollback SQL under `scripts/single-core-ledger/din-bridal/r5-rollback-*.sql`

## Complete R5 when

- Soak window elapsed with daily monitoring PASS, **or**
- Written accelerated waiver from Nadeem Khan recorded in repo
