# R5 DIN BRIDAL — Soak complete report

**Status:** `R5 COMPLETE — DIN BRIDAL UNIFIED LOADERS LIVE`  
**Date:** 2026-06-27  
**Main commit (evidence at soak completion):** `5ac71545`  
**Latest main commit (post-completion archive):** `91d00cf7` — see [`r5-post-completion-commit-reconciliation.md`](r5-post-completion-commit-reconciliation.md)

---

## Completion path

**Accelerated soak waiver** — Nadeem Khan, after Day 1 + Day 2 monitoring PASS.  
Waiver: [`r5-accelerated-soak-waiver.md`](r5-accelerated-soak-waiver.md)

Loaders live since: **2026-06-27T11:17:14Z**

---

## Monitoring evidence

| Run | Path | Result |
|-----|------|--------|
| Day 1 | `din-bridal-monitoring/production-monitoring-day1.md` | PASS |
| Day 2 | `din-bridal-monitoring/production-monitoring-day2.md` | PASS |
| Final | `din-bridal-monitoring/production-monitoring-final.md` | PASS |

---

## DIN BRIDAL golden values (production)

| Screen | Golden | PKR |
|--------|--------|-----|
| Ledger V2 / Account Statement / Party Ledger | MR REHAN ALI closing | 530,000 |
| Trial Balance | debit = credit | 21,919,575 |
| Roznamcha | Cash In / Out / Closing | 1,836,350 / 917,780 / 918,570 |

Fixtures: `reports/single-core-ledger/din-bridal/golden-fixtures.json`

---

## Final production state

| Item | State |
|------|-------|
| DIN BRIDAL unified flags | **12/12 ON** |
| DIN BRIDAL unified loaders | **5/5 ON** |
| DIN CHINA regression | **PASS** — 12 flags, 5 loaders unchanged |
| Other-company loaders | **0** |
| Cross-company leakage | **None** |

---

## Tests / build / deploy

| Gate | Result |
|------|--------|
| `npm run test:unified-ledger` | 245/245 PASS |
| `npm run build` | PASS |
| Frontend deploy | **Skipped** — flags-only; R5a frontend @ `11878c66` |

Rollback tag: `erp-frontend:rollback-before-r5a-20260627101510`  
Flag rollback: `scripts/single-core-ledger/din-bridal/r5-rollback-*.sql`

---

## Constraints honored

- No credentials committed
- No migrations / R7 / GL mutation / FX changes
- No other company enabled
- DIN CHINA unchanged
- No live loader logic changes

---

## Next recommended program phase

1. **Operational monitoring** — periodic `MONITORING_PROFILE=din-bridal` golden verify
2. **Next company expansion** — requires separate finance sign-off (e.g. DIN COUTURE)
3. **Legacy engine retirement** — blocked until all approved target companies stable (master plan Phase 5)

Do **not** auto-start another company rollout.
