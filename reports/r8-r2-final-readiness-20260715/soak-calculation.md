# R8-R2 Soak Calculation (dynamic, 2026-07-15)

| Field | Value |
|-------|-------|
| R8-R1 start (activation) | **2026-07-10** |
| Required duration | **30 calendar days** |
| Current date | **2026-07-15** |
| Elapsed calendar days | **5** `(2026-07-15 − 2026-07-10)` |
| Remaining calendar days | **25** `(30 − 5)` |
| Earliest physical deletion date | **2026-08-09** `(2026-07-10 + 30 days)` |
| Date gate met | **NO** |
| Physical deletion permitted today | **NO** |

## Formula

```
elapsed = current_date - r8_r1_start   # calendar days
remaining = max(0, 30 - elapsed)
earliest_deletion = r8_r1_start + 30 calendar days
date_gate_met = (current_date >= earliest_deletion)
```

Do **not** use hardcoded fractions from older docs (`2/30`, `5/30` as static labels) without recompute.

## Gate statement

On **2026-07-15**, R8-R2 physical legacy deletion is **legally/safely impossible**. Readiness documentation only.
