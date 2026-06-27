# R5 DIN BRIDAL — Soak status

**Status:** `R5 SOAK IN PROGRESS`  
**Updated:** 2026-06-27  
**Main commit:** `aeb4058b`

---

## Soak window

| Field | Value |
|-------|-------|
| Loaders live since | 2026-06-27T11:17:14Z (Stage 4 roznamcha loader) |
| Required soak | 72 hours |
| Checkpoint at | 2026-06-27T11:43:30Z |
| Elapsed | ~26 minutes |
| Remaining | ~71 hours 34 minutes |
| Earliest completion | 2026-06-30T11:17:14Z |
| Accelerated waiver | **None** |

---

## Checkpoint results (Day 2)

| Gate | Result |
|------|--------|
| Flag audit | PASS |
| Browser monitoring | PASS |
| DIN CHINA flags (read-only) | PASS — 12 ON |
| Other-company loaders | 0 |

---

## Monitoring evidence

| Day | Path |
|-----|------|
| 1 | `din-bridal-monitoring/production-monitoring-day1.md` |
| 2 | `din-bridal-monitoring/production-monitoring-day2.md` |

---

## Next monitoring

Re-run after **2026-06-28** (daily) or at **2026-06-30T11:17:14Z** for soak completion check.

```powershell
$env:MONITORING_PROFILE = "din-bridal"
node scripts/single-core-ledger/run-unified-ledger-monitoring-verify.mjs
```

Do **not** mark R5 complete until 72h elapsed with monitoring PASS.
