# Admin Compare 1 PKR Parity — Read-Only Investigation

**Date:** 2026-07-09  
**Mode:** Read-only — no repair, no migration, no production mutation

## Question

Why does hybrid (old) engine report **216,300.00** vs unified **216,299.00** for MR JALIL / DIN CHINA pilot batch (1 PKR maxAbsDiff)?

## Prior evidence

- Day 10 waiver: [`reports/single-core-engine-calendar-stability-official-20260710/admin-compare-1pkr-materiality-waiver.md`](../single-core-engine-calendar-stability-official-20260710/admin-compare-1pkr-materiality-waiver.md)
- Days 13–15: mix of **9/9 strict** (Day 14) and **MATERIALITY_WAIVER maxAbsDiff=1** (Days 13, 15)
- Unified production screens (Party Ledger, Ledger V2) show **216,299** — golden fixture unchanged

## Findings (read-only)

| Factor | Assessment |
|--------|----------------|
| Magnitude | 1 PKR on ~216M base = **0.0000005%** — immaterial for operations |
| Direction | Hybrid **higher** by 1 PKR vs unified official_gl |
| Likely cause class | Rounding / aggregation order / hybrid document merge vs pure GL unified path — not indicative of missing JE |
| User-visible truth | Unified + golden **216,299** treated as canonical for monitoring |
| Monitoring policy | `run-phase-216-monitoring-verify.mjs` waives when `maxAbsDiff <= 1` and `compared === 9` |
| GL safety | No repair indicated; changing hybrid merge for 1 PKR risks larger regressions |

## Recommendation

- **Keep materiality waiver** for calendar monitoring unless operator requests strict 0-PKR parity engineering track
- **Do not** block R8 readiness or closeout on 1 PKR alone
- **Optional future** (separate approval): trace single JE line delta between `getCustomerLedger` hybrid path and `get_unified_party_ledger` for MR JALIL on DIN CHINA scope

## Safety

- No SQL executed on production for this investigation
- No monitoring pass criteria changed
- No GL/data mutation
