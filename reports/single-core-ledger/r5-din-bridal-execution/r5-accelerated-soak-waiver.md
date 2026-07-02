# R5 DIN BRIDAL — Accelerated soak waiver

| Field | Value |
|-------|-------|
| **Approver** | Nadeem Khan |
| **Date** | 2026-06-27 |
| **Target company** | DIN BRIDAL |
| **Target company id** | `597a5292-14c8-4cd8-96bd-c61b5a0d8c92` |
| **Program** | OLD ERP / DIN Collection ERP — Single Core Ledger (NOT FX app) |

---

## Waiver statement

I, **Nadeem Khan**, approve **accelerated soak waiver** for **R5 DIN BRIDAL** after successful Day 1 and Day 2 production monitoring following staged unified-ledger enablement.

The **remaining 72-hour soak window is waived** provided that:

1. Final read-only flag audit PASS
2. Final `MONITORING_PROFILE=din-bridal` browser golden verify PASS
3. DIN CHINA regression PASS (flags unchanged)
4. Cross-company loader leakage = 0
5. `npm run test:unified-ledger` and `npm run build` PASS

If any final gate fails, R5 must **not** be marked complete and accounting logic must **not** be auto-patched.

---

## Reason

Time-sensitive completion after successful staged enablement (pilot → engine → screens → five loaders one-by-one) with consecutive monitoring PASS on golden fixtures (MR REHAN ALI, Trial Balance, Roznamcha).

---

## Prior soak evidence

| Item | Status |
|------|--------|
| Loaders live since | 2026-06-27T11:17:14Z |
| Day 1 monitoring | PASS — `production-monitoring-day1.md` |
| Day 2 monitoring | PASS — `production-monitoring-day2.md` |
| Flag state at waiver | DIN BRIDAL 12/12 ON, 5 loaders ON |

---

## Explicitly prohibited (unchanged)

This waiver does **NOT** authorize:

- Other-company unified loader expansion
- Database migrations (including R7 `roznamcha_payment` RPC)
- GL, journal, payment, or balance mutation
- FX / multi-currency application changes
- Changes to DIN CHINA unified loader behavior
- Bulk enablement or live loader logic changes

---

## Rollback

Per-loader L1 rollback: `scripts/single-core-ledger/din-bridal/r5-rollback-*.sql`  
Frontend rollback tag: `erp-frontend:rollback-before-r5a-20260627101510`

---

**Signed:** Nadeem Khan  
**Effective:** 2026-06-27
