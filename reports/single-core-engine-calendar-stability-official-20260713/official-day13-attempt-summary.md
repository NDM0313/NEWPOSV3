# Official Calendar Day 13 — 2026-07-08

**Classification:** **CALENDAR_STABILITY_DAY_PASS**

| Item | Value |
|------|--------|
| Run local date/time | 2026-07-08 17:18:08 → 17:35:00 +05:00 |
| Official stability window calendar day | **13** |
| Calendar days elapsed since 2026-07-01 | **12** |
| Monitoring artifact | `three-company-monitoring-2026-07-08T12-18-09-526Z` |
| Overall | **PASS** (Option A fixture refresh) |

## Attempt history

| Attempt | Result | Notes |
|---------|--------|-------|
| 1 | FAIL | CHINA Cash Out/Closing drift; BRIDAL/COUTURE UI flake |
| 2 | FAIL | Further CHINA TB/roznamcha drift; BRIDAL Cash In/Closing drift (loaders PASS) |
| **Final** | **PASS** | Option A CHINA+BRIDAL fixtures; COUTURE unchanged |

## Fixture refresh (Option A)

| Company | Change |
|---------|--------|
| DIN CHINA | TB **353,192,001.7**; roznamcha **109,088,121 / 74,675,317 / 34,412,804** |
| DIN BRIDAL | Roznamcha **2,968,850 / 1,794,607 / 1,174,243** |
| DIN COUTURE | unchanged |

## Validation

| Suite | Result |
|-------|--------|
| test:unified-ledger | 334/334 PASS |
| test:unit | 176/176 PASS |
| build | PASS |

Admin Compare: **MATERIALITY_WAIVER** maxAbsDiff=1 PKR (fail=9 under strict; waived as documented)
